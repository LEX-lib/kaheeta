/// <reference path="../pb_data/types.d.ts" />

// Kaheeta — shared expense splitting (Phase 2: groups & membership).
//
// DEPLOYMENT: copy this file into your PocketBase server's `pb_hooks/` directory
// (alongside pb_data). PocketBase auto-loads any `*.pb.js` file there.
//
// All writes for the split feature go through these superuser routes; the
// kaheeta_* collections have admin-only create/update/delete rules, so clients
// can never produce orphan/partial rows. Read access is enforced by the
// party-scoped List/View rules on the collections themselves.
//
// NOTE: PocketBase's goja runtime does NOT capture module-level declarations
// (const, var, function) inside callbacks passed to native Go functions such as
// routerAdd or runInTransaction. All collection names and helpers are therefore
// inlined at their use sites.

// POST /api/kaheeta/groups — create a group and add the creator as its first member.
routerAdd(
  "POST",
  "/api/kaheeta/groups",
  (e) => {
    const user = e.auth;
    const body = e.requestInfo().body;

    const name = (body.name || "").trim();
    if (!name) {
      throw new BadRequestError("Group name is required.");
    }
    const defaultCurrency = (body.default_currency || "USD").trim();

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const publicId = $security.randomStringWithAlphabet
      ? $security.randomStringWithAlphabet(15, alphabet)
      : $security.randomString(15);

    let created = null;
    try {
      $app.runInTransaction((txApp) => {
        const group = new Record(txApp.findCollectionByNameOrId("kaheeta_groups"));
        group.set("name", name);
        group.set("default_currency", defaultCurrency);
        group.set("simplify_debts", false);
        group.set("public_id", publicId);
        group.set("created_by", user.id);
        txApp.save(group);

        const member = new Record(txApp.findCollectionByNameOrId("kaheeta_group_members"));
        member.set("group", group.id);
        member.set("user", user.id);
        txApp.save(member);

        created = group;
      });
    } catch (err) {
      throw new BadRequestError("Transaction failed: " + (err.message || String(err)));
    }

    return e.json(200, {
      id: created.id,
      name: created.get("name"),
      public_id: created.get("public_id"),
      default_currency: created.get("default_currency"),
    });
  },
  $apis.requireAuth(),
);

// POST /api/kaheeta/split-expenses — create an expense plus its N participant
// shares atomically. The caller and the payer must both be group members, and
// the shares must sum exactly to the expense amount (integer minor units).
routerAdd(
  "POST",
  "/api/kaheeta/split-expenses",
  (e) => {
    const user = e.auth;
    const info = e.requestInfo();
    // Accept the plain JSON body (no file) or multipart with a `payload` JSON
    // string + `receipt` file, so adding a receipt stays a single request.
    let body = info.body || {};
    if (typeof body.payload === "string" && body.payload) {
      try {
        body = JSON.parse(body.payload);
      } catch (_) {
        throw new BadRequestError("Invalid expense payload.");
      }
    }
    // findUploadedFiles throws on non-multipart requests, so only call it when
    // the body is actually multipart (plain JSON writes carry no file).
    const receiptFiles = (e.request.header.get("Content-Type") || "").indexOf("multipart/form-data") !== -1
      ? e.findUploadedFiles("receipt")
      : [];

    const groupId = (body.group || "").trim();
    if (!groupId) {
      throw new BadRequestError("A group is required.");
    }
    const name = (body.name || "").trim();
    if (!name) {
      throw new BadRequestError("An expense name is required.");
    }
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError("Amount must be a positive integer (minor units).");
    }
    const currency = (body.currency || "USD").trim();
    const splitType = (body.split_type || "equal").trim();
    const expenseDate = (body.expense_date || "").trim();
    const paidBy = (body.paid_by || "").trim();
    if (!paidBy) {
      throw new BadRequestError("A payer is required.");
    }
    const notes = (body.notes || "").trim();
    if (notes.length > 2000) {
      throw new BadRequestError("Notes must be 2000 characters or fewer.");
    }
    const paymentMode = (body.payment_mode || "").trim();
    if (paymentMode && ["cash", "credit", "debit", "ewallet"].indexOf(paymentMode) === -1) {
      throw new BadRequestError("Invalid payment mode.");
    }

    const shares = Array.isArray(body.shares) ? body.shares : [];
    if (shares.length === 0) {
      throw new BadRequestError("At least one share is required.");
    }
    let shareSum = 0;
    for (let i = 0; i < shares.length; i++) {
      const shareAmount = Math.round(Number(shares[i].amount));
      const shareUser = (shares[i].user || "").trim();
      if (!shareUser) {
        throw new BadRequestError("Each share needs a user.");
      }
      if (!Number.isFinite(shareAmount)) {
        throw new BadRequestError("Each share needs a numeric amount.");
      }
      shareSum += shareAmount;
    }
    if (shareSum !== amount) {
      throw new BadRequestError("Shares must sum to the expense amount.");
    }

    // The caller must belong to the group.
    const callerMembership = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group = {:g} && user = {:u}",
      "", 1, 0,
      { g: groupId, u: user.id },
    );
    if (callerMembership.length === 0) {
      throw new ForbiddenError("You are not a member of this group.");
    }
    // The payer must belong to the group too.
    const payerMembership = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group = {:g} && user = {:u}",
      "", 1, 0,
      { g: groupId, u: paidBy },
    );
    if (payerMembership.length === 0) {
      throw new BadRequestError("The payer is not a member of this group.");
    }
    // Every share must be assigned to a member of the group.
    for (let i = 0; i < shares.length; i++) {
      const shareUserId = (shares[i].user || "").trim();
      const shareMembership = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: groupId, u: shareUserId },
      );
      if (shareMembership.length === 0) {
        throw new BadRequestError("A share is assigned to someone who is not a group member.");
      }
    }

    let created = null;
    try {
      $app.runInTransaction((txApp) => {
        const expense = new Record(txApp.findCollectionByNameOrId("kaheeta_split_expenses"));
        expense.set("group", groupId);
        expense.set("paid_by", paidBy);
        expense.set("added_by", user.id);
        expense.set("name", name);
        expense.set("amount", amount);
        expense.set("currency", currency);
        expense.set("split_type", splitType);
        expense.set("expense_date", expenseDate);
        expense.set("notes", notes);
        if (paymentMode) {
          expense.set("payment_mode", paymentMode);
        }
        if (receiptFiles.length > 0) {
          expense.set("receipt", receiptFiles[0]);
        }
        txApp.save(expense);

        for (let i = 0; i < shares.length; i++) {
          const share = new Record(txApp.findCollectionByNameOrId("kaheeta_split_shares"));
          share.set("expense", expense.id);
          share.set("user", (shares[i].user || "").trim());
          share.set("amount", Math.round(Number(shares[i].amount)));
          txApp.save(share);
        }

        created = expense;
      });
    } catch (err) {
      throw new BadRequestError("Create expense failed: " + (err.message || String(err)));
    }

    return e.json(200, {
      id: created.id,
      name: created.get("name"),
      amount: created.get("amount"),
    });
  },
  $apis.requireAuth(),
);

// DELETE /api/kaheeta/split-expenses/{id} — soft-delete an expense (or settlement)
// by stamping deleted_at. Any member of the expense's group may; group-less
// (friend-to-friend) rows stay restricted to whoever added them.
// Soft delete keeps the balance recompute correct and auditable.
routerAdd(
  "DELETE",
  "/api/kaheeta/split-expenses/{id}",
  (e) => {
    const user = e.auth;
    const expenseId = e.request.pathValue("id");

    let expense;
    try {
      expense = $app.findRecordById("kaheeta_split_expenses", expenseId);
    } catch (_) {
      throw new NotFoundError("Expense not found.");
    }

    let canDelete = expense.get("added_by") === user.id;
    const groupId = expense.get("group");
    if (!canDelete && groupId) {
      // Group expenses: any member of that group may modify them.
      const membership = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: groupId, u: user.id },
      );
      canDelete = membership.length > 0;
    }
    if (!canDelete) {
      throw new ForbiddenError(
        "Only members of this group can delete its expenses.",
      );
    }

    expense.set("deleted_at", new Date().toISOString());
    try {
      $app.save(expense);
    } catch (err) {
      throw new BadRequestError("Delete failed: " + (err.message || String(err)));
    }

    return e.json(200, { ok: true });
  },
  $apis.requireAuth(),
);

// PATCH /api/kaheeta/split-expenses/{id} — edit an expense atomically: update its
// fields and REPLACE its shares (delete old, insert new). Any member of the
// expense's group may (settlements included); group-less rows stay restricted to
// whoever added them. Re-runs the same validation as create.
routerAdd(
  "PATCH",
  "/api/kaheeta/split-expenses/{id}",
  (e) => {
    const user = e.auth;
    const expenseId = e.request.pathValue("id");
    const info = e.requestInfo();
    let body = info.body || {};
    if (typeof body.payload === "string" && body.payload) {
      try {
        body = JSON.parse(body.payload);
      } catch (_) {
        throw new BadRequestError("Invalid expense payload.");
      }
    }
    // findUploadedFiles throws on non-multipart requests, so only call it when
    // the body is actually multipart (plain JSON writes carry no file).
    const receiptFiles = (e.request.header.get("Content-Type") || "").indexOf("multipart/form-data") !== -1
      ? e.findUploadedFiles("receipt")
      : [];
    const removeReceipt = body.remove_receipt === true || body.remove_receipt === "true";

    let expense;
    try {
      expense = $app.findRecordById("kaheeta_split_expenses", expenseId);
    } catch (_) {
      throw new NotFoundError("Expense not found.");
    }

    const groupId = expense.get("group");

    let canEdit = expense.get("added_by") === user.id;
    if (!canEdit && groupId) {
      // Group expenses: any member of that group may modify them.
      const membership = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: groupId, u: user.id },
      );
      canEdit = membership.length > 0;
    }
    if (!canEdit) {
      throw new ForbiddenError(
        "Only members of this group can edit its expenses.",
      );
    }

    const name = (body.name || "").trim();
    if (!name) {
      throw new BadRequestError("An expense name is required.");
    }
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError("Amount must be a positive integer (minor units).");
    }
    const currency = (body.currency || "USD").trim();
    const storedSplitType = expense.get("split_type");
    let splitType = (body.split_type || storedSplitType || "equal").trim();
    // A settlement stays a settlement: editing its amount/date/parties must not
    // silently turn it into a normal shared expense.
    if (storedSplitType === "settlement") {
      splitType = "settlement";
    }
    const expenseDate = (body.expense_date || "").trim();
    const paidBy = (body.paid_by || "").trim();
    if (!paidBy) {
      throw new BadRequestError("A payer is required.");
    }
    const notes = (body.notes || "").trim();
    if (notes.length > 2000) {
      throw new BadRequestError("Notes must be 2000 characters or fewer.");
    }
    const paymentMode = (body.payment_mode || "").trim();
    if (paymentMode && ["cash", "credit", "debit", "ewallet"].indexOf(paymentMode) === -1) {
      throw new BadRequestError("Invalid payment mode.");
    }

    const shares = Array.isArray(body.shares) ? body.shares : [];
    if (shares.length === 0) {
      throw new BadRequestError("At least one share is required.");
    }
    if (splitType === "settlement") {
      if (shares.length !== 1) {
        throw new BadRequestError("A settlement must have exactly one counterparty.");
      }
      if ((shares[0].user || "").trim() === paidBy) {
        throw new BadRequestError("A settlement needs two different people.");
      }
    }
    let shareSum = 0;
    for (let i = 0; i < shares.length; i++) {
      const shareAmount = Math.round(Number(shares[i].amount));
      const shareUser = (shares[i].user || "").trim();
      if (!shareUser) {
        throw new BadRequestError("Each share needs a user.");
      }
      if (!Number.isFinite(shareAmount)) {
        throw new BadRequestError("Each share needs a numeric amount.");
      }
      shareSum += shareAmount;
    }
    if (shareSum !== amount) {
      throw new BadRequestError("Shares must sum to the expense amount.");
    }

    // The payer must belong to the group.
    const payerMembership = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group = {:g} && user = {:u}",
      "", 1, 0,
      { g: groupId, u: paidBy },
    );
    if (payerMembership.length === 0) {
      throw new BadRequestError("The payer is not a member of this group.");
    }
    // Every share must be assigned to a member of the group.
    for (let i = 0; i < shares.length; i++) {
      const shareUserId = (shares[i].user || "").trim();
      const shareMembership = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: groupId, u: shareUserId },
      );
      if (shareMembership.length === 0) {
        throw new BadRequestError("A share is assigned to someone who is not a group member.");
      }
    }

    try {
      $app.runInTransaction((txApp) => {
        expense.set("paid_by", paidBy);
        expense.set("name", name);
        expense.set("amount", amount);
        expense.set("currency", currency);
        expense.set("split_type", splitType);
        expense.set("expense_date", expenseDate);
        expense.set("notes", notes);
        expense.set("payment_mode", paymentMode);
        if (receiptFiles.length > 0) {
          expense.set("receipt", receiptFiles[0]);
        } else if (removeReceipt) {
          const currentReceipt = expense.getString("receipt");
          if (currentReceipt) {
            expense.set("receipt-", [currentReceipt]);
          }
        }
        txApp.save(expense);

        // Replace shares: delete the existing rows, then insert the new set.
        const old = txApp.findRecordsByFilter(
          "kaheeta_split_shares",
          "expense = {:e}",
          "", 0, 0,
          { e: expense.id },
        );
        for (let i = 0; i < old.length; i++) {
          txApp.delete(old[i]);
        }
        for (let i = 0; i < shares.length; i++) {
          const share = new Record(txApp.findCollectionByNameOrId("kaheeta_split_shares"));
          share.set("expense", expense.id);
          share.set("user", (shares[i].user || "").trim());
          share.set("amount", Math.round(Number(shares[i].amount)));
          txApp.save(share);
        }
      });
    } catch (err) {
      throw new BadRequestError("Edit expense failed: " + (err.message || String(err)));
    }

    return e.json(200, { id: expense.id, name: expense.get("name"), amount: expense.get("amount") });
  },
  $apis.requireAuth(),
);

// POST /api/kaheeta/groups/join — join a group by its public_id (the invite code).
routerAdd(
  "POST",
  "/api/kaheeta/groups/join",
  (e) => {
    const user = e.auth;
    const body = e.requestInfo().body;
    const publicId = (body.public_id || "").trim();
    if (!publicId) {
      throw new BadRequestError("A join code is required.");
    }

    let group;
    try {
      group = $app.findFirstRecordByFilter("kaheeta_groups", "public_id = {:pid}", { pid: publicId });
    } catch (_) {
      throw new NotFoundError("No group found for that join code.");
    }

    try {
      const existing = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: group.id, u: user.id },
      );
      if (existing.length === 0) {
        const member = new Record($app.findCollectionByNameOrId("kaheeta_group_members"));
        member.set("group", group.id);
        member.set("user", user.id);
        $app.save(member);
      }
    } catch (err) {
      throw new BadRequestError("Join failed: " + (err.message || String(err)));
    }

    return e.json(200, { id: group.id, name: group.get("name") });
  },
  $apis.requireAuth(),
);

// GET /api/kaheeta/groups/{id}/members — list a group's members with their
// display names. The users collection's view rule is locked to self, so clients
// can't expand other members' names directly; this superuser route resolves them
// but only for callers who are themselves members (scoped to the group, not the
// whole user directory).
routerAdd(
  "GET",
  "/api/kaheeta/groups/{id}/members",
  (e) => {
    const user = e.auth;
    const groupId = e.request.pathValue("id");

    const callerMembership = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group = {:g} && user = {:u}",
      "", 1, 0,
      { g: groupId, u: user.id },
    );
    if (callerMembership.length === 0) {
      throw new ForbiddenError("You are not a member of this group.");
    }

    const rows = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group = {:g}",
      "created", 0, 0,
      { g: groupId },
    );
    const members = [];
    for (let i = 0; i < rows.length; i++) {
      const uid = rows[i].get("user");
      let name = "";
      let email = "";
      let avatar = "";
      try {
        const u = $app.findRecordById("users", uid);
        name = u.get("name") || "";
        email = u.get("email") || "";
        avatar = u.get("avatar") || "";
      } catch (_) {
        // user missing — leave blank
      }
      members.push({ id: rows[i].id, user: uid, name: name, email: email, avatar: avatar });
    }

    return e.json(200, { members: members });
  },
  $apis.requireAuth(),
);

// GET /api/kaheeta/groups/{id}/suggested-members — people the caller has already
// shared groups with, most frequent first, excluding the caller and anyone
// already in this group. Owner-only (only the owner can add members). Scoped to
// groups the caller owns so it never exposes the wider user directory.
routerAdd(
  "GET",
  "/api/kaheeta/groups/{id}/suggested-members",
  (e) => {
    const user = e.auth;
    const groupId = e.request.pathValue("id");

    let group;
    try {
      group = $app.findRecordById("kaheeta_groups", groupId);
    } catch (_) {
      throw new NotFoundError("Group not found.");
    }
    if (group.get("created_by") !== user.id) {
      throw new ForbiddenError("Only the group owner can add members.");
    }

    // Skip the caller and everyone already in this group.
    const excluded = {};
    excluded[user.id] = true;
    const current = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group = {:g}",
      "", 0, 0,
      { g: groupId },
    );
    for (let i = 0; i < current.length; i++) {
      excluded[current[i].get("user")] = true;
    }

    // Membership rows across every group the caller owns.
    const rows = $app.findRecordsByFilter(
      "kaheeta_group_members",
      "group.created_by = {:u}",
      "", 0, 0,
      { u: user.id },
    );

    const counts = {};
    const order = [];
    for (let i = 0; i < rows.length; i++) {
      const uid = rows[i].get("user");
      if (!uid || excluded[uid]) {
        continue;
      }
      if (counts[uid] === undefined) {
        counts[uid] = 0;
        order.push(uid);
      }
      counts[uid] += 1;
    }

    const contacts = [];
    for (let i = 0; i < order.length; i++) {
      const uid = order[i];
      let name = "";
      let email = "";
      let avatar = "";
      try {
        const u = $app.findRecordById("users", uid);
        name = u.get("name") || "";
        email = u.get("email") || "";
        avatar = u.get("avatar") || "";
      } catch (_) {
        // user missing — keep the row out of the suggestions
        continue;
      }
      contacts.push({
        user: uid,
        name: name,
        email: email,
        avatar: avatar,
        shared_groups: counts[uid],
      });
    }

    contacts.sort((a, b) => {
      if (b.shared_groups !== a.shared_groups) return b.shared_groups - a.shared_groups;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });

    return e.json(200, { contacts: contacts.slice(0, 8) });
  },
  $apis.requireAuth(),
);

// POST /api/kaheeta/groups/{id}/members — owner adds a member by email or user id.
routerAdd(
  "POST",
  "/api/kaheeta/groups/{id}/members",
  (e) => {
    const user = e.auth;
    const groupId = e.request.pathValue("id");
    const body = e.requestInfo().body;
    const email = (body.email || "").trim().toLowerCase();
    const targetUserId = (body.user || "").trim();
    if (!email && !targetUserId) {
      throw new BadRequestError("An email or user id is required.");
    }

    let group;
    try {
      group = $app.findRecordById("kaheeta_groups", groupId);
    } catch (_) {
      throw new NotFoundError("Group not found.");
    }
    if (group.get("created_by") !== user.id) {
      throw new ForbiddenError("Only the group owner can add members.");
    }

    let target;
    if (targetUserId) {
      try {
        target = $app.findRecordById("users", targetUserId);
      } catch (_) {
        throw new NotFoundError("No Kaheeta user with that id.");
      }
    } else {
      try {
        target = $app.findFirstRecordByFilter("users", "email = {:em}", { em: email });
      } catch (_) {
        throw new NotFoundError("No Kaheeta user with that email.");
      }
    }

    try {
      const existing = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: groupId, u: target.id },
      );
      if (existing.length === 0) {
        const member = new Record($app.findCollectionByNameOrId("kaheeta_group_members"));
        member.set("group", groupId);
        member.set("user", target.id);
        $app.save(member);
      }
    } catch (err) {
      throw new BadRequestError("Add member failed: " + (err.message || String(err)));
    }

    return e.json(200, { ok: true, user: target.id });
  },
  $apis.requireAuth(),
);

// DELETE /api/kaheeta/groups/{id}/leave — remove the caller's own membership.
routerAdd(
  "DELETE",
  "/api/kaheeta/groups/{id}/leave",
  (e) => {
    const user = e.auth;
    const groupId = e.request.pathValue("id");

    let group;
    try {
      group = $app.findRecordById("kaheeta_groups", groupId);
    } catch (_) {
      throw new NotFoundError("Group not found.");
    }
    if (group.get("created_by") === user.id) {
      throw new BadRequestError("The group owner can't leave. Delete the group instead.");
    }

    try {
      const rows = $app.findRecordsByFilter(
        "kaheeta_group_members",
        "group = {:g} && user = {:u}",
        "", 1, 0,
        { g: groupId, u: user.id },
      );
      if (rows.length > 0) {
        $app.delete(rows[0]);
      }
    } catch (err) {
      throw new BadRequestError("Leave failed: " + (err.message || String(err)));
    }

    return e.json(200, { ok: true });
  },
  $apis.requireAuth(),
);

// PATCH /api/kaheeta/groups/{id} — owner renames and/or archives the group.
routerAdd(
  "PATCH",
  "/api/kaheeta/groups/{id}",
  (e) => {
    const user = e.auth;
    const groupId = e.request.pathValue("id");
    const body = e.requestInfo().body;

    let group;
    try {
      group = $app.findRecordById("kaheeta_groups", groupId);
    } catch (_) {
      throw new NotFoundError("Group not found.");
    }
    if (group.get("created_by") !== user.id) {
      throw new ForbiddenError("Only the group owner can edit it.");
    }

    if (typeof body.name === "string" && body.name.trim()) {
      group.set("name", body.name.trim());
    }
    if (body.archived === true) {
      group.set("archived_at", new Date().toISOString());
    } else if (body.archived === false) {
      group.set("archived_at", "");
    }
    if (typeof body.simplify_debts === "boolean") {
      group.set("simplify_debts", body.simplify_debts);
    }
    $app.save(group);

    return e.json(200, { ok: true });
  },
  $apis.requireAuth(),
);

// DELETE /api/kaheeta/groups/{id} — owner deletes the group (cascades memberships).
routerAdd(
  "DELETE",
  "/api/kaheeta/groups/{id}",
  (e) => {
    const user = e.auth;
    const groupId = e.request.pathValue("id");

    let group;
    try {
      group = $app.findRecordById("kaheeta_groups", groupId);
    } catch (_) {
      throw new NotFoundError("Group not found.");
    }
    if (group.get("created_by") !== user.id) {
      throw new ForbiddenError("Only the group owner can delete it.");
    }

    $app.delete(group);
    return e.json(200, { ok: true });
  },
  $apis.requireAuth(),
);
