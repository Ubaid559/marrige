require("dotenv").config();

const { Telegraf, Markup, session } = require("telegraf");

const {
  getUserByTelegramId,
  getUserById,
  createUser,
  getAllUsers,
  getUserCount,
  createRequest,
  getPendingRequest,
  getRequestById,
  updateRequestStatus,
} = require("./database");

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = String(process.env.ADMIN_ID);

bot.use(session());



function isAdmin(ctx) {
  return String(ctx.from.id) === ADMIN_ID;
}

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("تسجيل كعريس", "register_groom"),

      Markup.button.callback("تسجيل كعروسة", "register_bride"),
    ],

    [Markup.button.callback("مشاهدة العرائس", "show_brides")],

    [Markup.button.callback("مشاهدة العرسان", "show_grooms")],

    [Markup.button.callback("إرسال رسالة للإدارة", "message_admin")],

    [Markup.button.callback("عدد المسجلين", "statistics")],
  ]);
}


bot.start(async (ctx) => {
  const user = getUserByTelegramId(ctx.from.id);

  if (user) {
    const type = user.type === "groom" ? "عريس" : "عروسة";

    return ctx.reply(
      `أهلاً بيك من جديد.

أنت مسجل في النظام كـ ${type}.

رقم تسجيلك:
${user.id}

اختار من القائمة.`,
      mainMenu(),
    );
  }

  await ctx.reply(
    `أهلاً بيك في بوت الزواج.

اختار طريقة التسجيل.

رقم الهاتف لا يظهر لأي مستخدم آخر.

رقم الهاتف يظهر للإدارة فقط.`,
    mainMenu(),
  );
});


bot.action("register_groom", async (ctx) => {
  await ctx.answerCbQuery();

  const existing = getUserByTelegramId(ctx.from.id);

  if (existing) {
    return ctx.reply("أنت مسجل بالفعل في النظام.");
  }

  ctx.session = {
    mode: "registration",

    step: "name",

    data: {
      telegram_id: String(ctx.from.id),

      type: "groom",

      first_name: "",

      username: ctx.from.username || "",
    },
  };

  await ctx.reply("تسجيل عريس\n\nاكتب اسمك بالكامل.");
});


bot.action("register_bride", async (ctx) => {
  await ctx.answerCbQuery();

  const existing = getUserByTelegramId(ctx.from.id);

  if (existing) {
    return ctx.reply("أنتِ مسجلة بالفعل في النظام.");
  }

  ctx.session = {
    mode: "registration",

    step: "name",

    data: {
      telegram_id: String(ctx.from.id),

      type: "bride",

      first_name: "",

      username: ctx.from.username || "",
    },
  };

  await ctx.reply("تسجيل عروسة\n\nاكتبي اسمك بالكامل.");
});



bot.action("message_admin", async (ctx) => {
  await ctx.answerCbQuery();

  const user = getUserByTelegramId(ctx.from.id);

  if (!user) {
    return ctx.reply("لازم تسجل بياناتك الأول.");
  }

  ctx.session = {
    mode: "admin_message",
  };

  await ctx.reply(
    `اكتب رسالتك للإدارة الآن.

سيتم إرسال الرسالة للإدارة مع بيانات حسابك.

رقم الهاتف لا يظهر للمستخدمين الآخرين.`,
  );
});



bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) {
    return;
  }

  

  if (ctx.session && ctx.session.mode === "admin_reply") {
    if (!isAdmin(ctx)) {
      ctx.session = null;

      return ctx.reply("غير مسموح.");
    }

    const targetTelegramId = ctx.session.targetTelegramId;

    try {
      await bot.telegram.sendMessage(
        targetTelegramId,
        `رسالة من إدارة البوت

${text}`,
      );

      ctx.session = null;

      return ctx.reply("تم إرسال الرد للمستخدم بنجاح.");
    } catch (error) {
      console.error("ADMIN REPLY ERROR:", error);

      ctx.session = null;

      return ctx.reply("تعذر إرسال الرسالة للمستخدم.");
    }
  }

  

  if (ctx.session && ctx.session.mode === "admin_message") {
    const user = getUserByTelegramId(ctx.from.id);

    if (!user) {
      ctx.session = null;

      return ctx.reply("لازم تسجل بياناتك الأول.");
    }

    const type = user.type === "groom" ? "عريس" : "عروسة";

    const username = user.username ? `@${user.username}` : "لا يوجد Username";

    const adminMessage = `
رسالة جديدة من مستخدم

========================

رقم التسجيل:
${user.id}

النوع:
${type}

الاسم:
${user.first_name}

Username:
${username}

Telegram ID:
${user.telegram_id}

رقم الهاتف:
${user.phone}

========================

الرسالة:

${text}
`;

    try {
      await bot.telegram.sendMessage(
        ADMIN_ID,

        adminMessage,

        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "الرد على المستخدم",
              `reply_user:${user.telegram_id}`,
            ),
          ],
        ]),
      );

      ctx.session = null;

      return ctx.reply(`تم إرسال رسالتك إلى الإدارة بنجاح.`, mainMenu());
    } catch (error) {
      console.error("SEND MESSAGE ERROR:", error);

      ctx.session = null;

      return ctx.reply("حدث خطأ أثناء إرسال الرسالة.");
    }
  }

  // =================================================
  // REGISTRATION
  // =================================================

  if (!ctx.session || ctx.session.mode !== "registration") {
    return ctx.reply("اختار من القائمة.", mainMenu());
  }

  const data = ctx.session.data;

  // NAME

  if (ctx.session.step === "name") {
    data.first_name = text;

    ctx.session.step = "age";

    return ctx.reply("اكتب سنك.");
  }

  // AGE

  if (ctx.session.step === "age") {
    if (!/^\d+$/.test(text)) {
      return ctx.reply("اكتب السن بالأرقام فقط.");
    }

    const age = Number(text);

    if (age < 18 || age > 100) {
      return ctx.reply("اكتب سن صحيح.");
    }

    data.age = age;

    ctx.session.step = "city";

    return ctx.reply("اكتب المحافظة أو المدينة.");
  }

  // CITY

  if (ctx.session.step === "city") {
    data.city = text;

    ctx.session.step = "education";

    return ctx.reply("اكتب المؤهل الدراسي.");
  }

  // EDUCATION

  if (ctx.session.step === "education") {
    data.education = text;

    ctx.session.step = "job";

    return ctx.reply("اكتب الوظيفة أو مجال العمل.");
  }

  // JOB

  if (ctx.session.step === "job") {
    data.job = text;

    ctx.session.step = "marital_status";

    return ctx.reply("اكتب الحالة الاجتماعية.");
  }

  // MARITAL STATUS

  if (ctx.session.step === "marital_status") {
    data.marital_status = text;

    ctx.session.step = "religion";

    return ctx.reply("اكتب الديانة.");
  }

  // RELIGION

  if (ctx.session.step === "religion") {
    data.religion = text;

    ctx.session.step = "height";

    return ctx.reply("اكتب الطول.");
  }

  // HEIGHT

  if (ctx.session.step === "height") {
    data.height = text;

    ctx.session.step = "description";

    return ctx.reply("اكتب نبذة قصيرة عن نفسك.");
  }

  // DESCRIPTION

  if (ctx.session.step === "description") {
    data.description = text;

    ctx.session.step = "phone";

    return ctx.reply(
      `آخر خطوة.

اكتب رقم هاتفك.

رقم الهاتف لا يظهر لأي عريس أو عروسة.

رقم الهاتف يظهر للإدارة فقط.

بإرسال الرقم أنت توافق على اطلاع الإدارة عليه.`,
    );
  }

  // PHONE

  if (ctx.session.step === "phone") {
    const phone = text.replace(/[^\d+]/g, "");

    if (phone.length < 8) {
      return ctx.reply("رقم الهاتف غير صحيح. اكتب الرقم مرة أخرى.");
    }

    data.phone = phone;

    data.username = ctx.from.username || "";

    const existing = getUserByTelegramId(ctx.from.id);

    if (existing) {
      ctx.session = null;

      return ctx.reply("أنت مسجل بالفعل.");
    }

    const user = createUser(data);

    ctx.session = null;

    const type = user.type === "groom" ? "عريس" : "عروسة";

    await ctx.reply(
      `تم التسجيل بنجاح.

نوع التسجيل:
${type}

رقم تسجيلك:
${user.id}

رقم الهاتف محفوظ للإدارة فقط.`,
      mainMenu(),
    );

    await notifyAdminNewUser(user);

    return;
  }
});

// =====================================================
// NEW USER -> ADMIN
// =====================================================

async function notifyAdminNewUser(user) {
  const type = user.type === "groom" ? "عريس" : "عروسة";

  const username = user.username ? `@${user.username}` : "لا يوجد";

  const message = `
مستخدم جديد سجل في البوت

========================

رقم التسجيل:
${user.id}

النوع:
${type}

الاسم:
${user.first_name}

Username:
${username}

Telegram ID:
${user.telegram_id}

العمر:
${user.age}

المدينة:
${user.city}

التعليم:
${user.education}

العمل:
${user.job}

الحالة الاجتماعية:
${user.marital_status}

الديانة:
${user.religion}

الطول:
${user.height}

النبذة:
${user.description}

رقم الهاتف:
${user.phone}
`;

  await bot.telegram.sendMessage(ADMIN_ID, message);
}

// =====================================================
// SHOW BRIDES
// =====================================================

bot.action("show_brides", async (ctx) => {
  await ctx.answerCbQuery();

  const currentUser = getUserByTelegramId(ctx.from.id);

  if (!currentUser) {
    return ctx.reply("لازم تسجل الأول.", mainMenu());
  }

  if (currentUser.type !== "groom") {
    return ctx.reply("مشاهدة العرائس متاحة للعرسان فقط.");
  }

  const brides = getAllUsers("bride");

  if (!brides.length) {
    return ctx.reply("لا توجد عرائس مسجلات حتى الآن.");
  }

  let message = `
قائمة العرائس

عدد العرائس:
${brides.length}

`;

  const buttons = [];

  for (const bride of brides) {
    message += `
العروسة رقم ${bride.id}

الاسم:
${bride.first_name}

العمر:
${bride.age}

المدينة:
${bride.city}

التعليم:
${bride.education}

العمل:
${bride.job}

الحالة الاجتماعية:
${bride.marital_status}

الديانة:
${bride.religion}

الطول:
${bride.height}

النبذة:
${bride.description}

------------------------
`;

    buttons.push([
      Markup.button.callback(
        `اختيار العروسة رقم ${bride.id}`,
        `choose_bride:${bride.id}`,
      ),
    ]);
  }

  return ctx.reply(message, Markup.inlineKeyboard(buttons));
});

// =====================================================
// SHOW GROOMS
// =====================================================

bot.action("show_grooms", async (ctx) => {
  await ctx.answerCbQuery();

  const currentUser = getUserByTelegramId(ctx.from.id);

  if (!currentUser) {
    return ctx.reply("لازم تسجل الأول.", mainMenu());
  }

  if (currentUser.type !== "bride") {
    return ctx.reply("مشاهدة العرسان متاحة للعرائس فقط.");
  }

  const grooms = getAllUsers("groom");

  if (!grooms.length) {
    return ctx.reply("لا يوجد عرسان مسجلون حتى الآن.");
  }

  let message = `
قائمة العرسان

عدد العرسان:
${grooms.length}

`;

  const buttons = [];

  for (const groom of grooms) {
    message += `
العريس رقم ${groom.id}

الاسم:
${groom.first_name}

العمر:
${groom.age}

المدينة:
${groom.city}

التعليم:
${groom.education}

العمل:
${groom.job}

الحالة الاجتماعية:
${groom.marital_status}

الديانة:
${groom.religion}

الطول:
${groom.height}

النبذة:
${groom.description}

------------------------
`;

    buttons.push([
      Markup.button.callback(
        `اختيار العريس رقم ${groom.id}`,
        `choose_groom:${groom.id}`,
      ),
    ]);
  }

  return ctx.reply(message, Markup.inlineKeyboard(buttons));
});


bot.action(/^choose_bride:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const brideId = Number(ctx.match[1]);

  const groom = getUserByTelegramId(ctx.from.id);

  if (!groom) {
    return ctx.reply("لازم تسجل الأول.");
  }

  if (groom.type !== "groom") {
    return ctx.reply("اختيار العرائس متاح للعرسان فقط.");
  }

  const bride = getUserById(brideId);

  if (!bride || bride.type !== "bride") {
    return ctx.reply("العروسة غير موجودة.");
  }

  const existing = getPendingRequest(groom.id, bride.id);

  if (existing) {
    return ctx.reply("لقد أرسلت طلبًا لهذه العروسة بالفعل.");
  }

  return ctx.reply(
    `العروسة رقم ${bride.id}

الاسم:
${bride.first_name}

هل تريد إرسال طلب زواج إليها؟`,

    Markup.inlineKeyboard([
      [Markup.button.callback("إرسال الطلب", `confirm_bride:${bride.id}`)],

      [Markup.button.callback("إلغاء", "cancel_request")],
    ]),
  );
});

// =====================================================
// CONFIRM BRIDE
// =====================================================

bot.action(/^confirm_bride:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const brideId = Number(ctx.match[1]);

  const groom = getUserByTelegramId(ctx.from.id);

  const bride = getUserById(brideId);

  if (!groom || !bride) {
    return ctx.reply("حدث خطأ في بيانات الطلب.");
  }

  const existing = getPendingRequest(groom.id, bride.id);

  if (existing) {
    return ctx.reply("تم إرسال الطلب بالفعل.");
  }

  const result = createRequest(groom.id, bride.id);

  await ctx.reply(
    `تم إرسال طلب الزواج.

رقم الطلب:
${result.lastInsertRowid}

سيتم مراجعة الطلب من الإدارة.`,
  );

  await sendRequestToAdmin(result.lastInsertRowid);
});

// =====================================================
// CHOOSE GROOM
// =====================================================

bot.action(/^choose_groom:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const groomId = Number(ctx.match[1]);

  const bride = getUserByTelegramId(ctx.from.id);

  if (!bride) {
    return ctx.reply("لازم تسجلي الأول.");
  }

  if (bride.type !== "bride") {
    return ctx.reply("اختيار العرسان متاح للعرائس فقط.");
  }

  const groom = getUserById(groomId);

  if (!groom || groom.type !== "groom") {
    return ctx.reply("العريس غير موجود.");
  }

  const existing = getPendingRequest(groom.id, bride.id);

  if (existing) {
    return ctx.reply("لقد أرسلتِ طلبًا لهذا العريس بالفعل.");
  }

  return ctx.reply(
    `العريس رقم ${groom.id}

الاسم:
${groom.first_name}

هل تريدين إرسال طلب زواج إليه؟`,

    Markup.inlineKeyboard([
      [Markup.button.callback("إرسال الطلب", `confirm_groom:${groom.id}`)],

      [Markup.button.callback("إلغاء", "cancel_request")],
    ]),
  );
});

// =====================================================
// CONFIRM GROOM
// =====================================================

bot.action(/^confirm_groom:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const groomId = Number(ctx.match[1]);

  const bride = getUserByTelegramId(ctx.from.id);

  const groom = getUserById(groomId);

  if (!bride || !groom) {
    return ctx.reply("حدث خطأ في بيانات الطلب.");
  }

  const existing = getPendingRequest(groom.id, bride.id);

  if (existing) {
    return ctx.reply("تم إرسال الطلب بالفعل.");
  }

  const result = createRequest(groom.id, bride.id);

  await ctx.reply(
    `تم إرسال طلب الزواج.

رقم الطلب:
${result.lastInsertRowid}

سيتم مراجعة الطلب من الإدارة.`,
  );

  await sendRequestToAdmin(result.lastInsertRowid);
});

// =====================================================
// CANCEL
// =====================================================

bot.action("cancel_request", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply("تم إلغاء الطلب.", mainMenu());
});

// =====================================================
// SEND REQUEST TO ADMIN
// =====================================================

async function sendRequestToAdmin(requestId) {
  const request = getRequestById(requestId);

  if (!request) {
    return;
  }

  const groom = getUserById(request.groom_id);

  const bride = getUserById(request.bride_id);

  if (!groom || !bride) {
    return;
  }

  const groomUsername = groom.username ? `@${groom.username}` : "لا يوجد";

  const brideUsername = bride.username ? `@${bride.username}` : "لا يوجد";

  const message = `
طلب زواج جديد

========================

رقم الطلب:
${request.id}

العريس

رقم التسجيل:
${groom.id}

الاسم:
${groom.first_name}

Username:
${groomUsername}

Telegram ID:
${groom.telegram_id}

الهاتف:
${groom.phone}

العمر:
${groom.age}

المدينة:
${groom.city}

التعليم:
${groom.education}

العمل:
${groom.job}

الحالة الاجتماعية:
${groom.marital_status}

الديانة:
${groom.religion}

الطول:
${groom.height}

النبذة:
${groom.description}

========================

العروسة

رقم التسجيل:
${bride.id}

الاسم:
${bride.first_name}

Username:
${brideUsername}

Telegram ID:
${bride.telegram_id}

الهاتف:
${bride.phone}

العمر:
${bride.age}

المدينة:
${bride.city}

التعليم:
${bride.education}

العمل:
${bride.job}

الحالة الاجتماعية:
${bride.marital_status}

الديانة:
${bride.religion}

الطول:
${bride.height}

النبذة:
${bride.description}

========================

حالة الطلب:
قيد المراجعة
`;

  await bot.telegram.sendMessage(
    ADMIN_ID,

    message,

    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "الرد على العريس",
          `reply_user:${groom.telegram_id}`,
        ),
      ],

      [
        Markup.button.callback(
          "الرد على العروسة",
          `reply_user:${bride.telegram_id}`,
        ),
      ],

      [
        Markup.button.callback("قبول الطلب", `accept_request:${request.id}`),

        Markup.button.callback("رفض الطلب", `reject_request:${request.id}`),
      ],
    ]),
  );
}

// =====================================================
// ADMIN REPLY BUTTON
// =====================================================

bot.action(/^reply_user:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery("غير مسموح");
  }

  await ctx.answerCbQuery();

  const telegramId = ctx.match[1];

  ctx.session = {
    mode: "admin_reply",

    targetTelegramId: telegramId,
  };

  await ctx.reply("اكتب الرسالة التي تريد إرسالها للمستخدم.");
});

// =====================================================
// ACCEPT REQUEST
// =====================================================

bot.action(/^accept_request:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery("غير مسموح");
  }

  await ctx.answerCbQuery();

  const requestId = Number(ctx.match[1]);

  const request = getRequestById(requestId);

  if (!request) {
    return ctx.reply("الطلب غير موجود.");
  }

  updateRequestStatus(requestId, "accepted");

  const groom = getUserById(request.groom_id);

  const bride = getUserById(request.bride_id);

  await ctx.reply(
    `تم قبول الطلب رقم ${requestId}.

العريس:
${groom.first_name}

رقم الهاتف:
${groom.phone}

العروسة:
${bride.first_name}

رقم الهاتف:
${bride.phone}`,
  );
});

// =====================================================
// REJECT REQUEST
// =====================================================

bot.action(/^reject_request:(\d+)$/, async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery("غير مسموح");
  }

  await ctx.answerCbQuery();

  const requestId = Number(ctx.match[1]);

  const request = getRequestById(requestId);

  if (!request) {
    return ctx.reply("الطلب غير موجود.");
  }

  updateRequestStatus(requestId, "rejected");

  await ctx.reply(`تم رفض الطلب رقم ${requestId}.`);
});

// =====================================================
// STATISTICS
// =====================================================

bot.action("statistics", async (ctx) => {
  await ctx.answerCbQuery();

  const grooms = getUserCount("groom");

  const brides = getUserCount("bride");

  await ctx.reply(`
إحصائيات التسجيل

العرسان:
${grooms}

العرائس:
${brides}

إجمالي المسجلين:
${grooms + brides}
`);
});



bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply("غير مسموح لك بالدخول.");
  }

  const grooms = getUserCount("groom");

  const brides = getUserCount("bride");

  await ctx.reply(
    `لوحة الإدارة

العرسان:
${grooms}

العرائس:
${brides}

الإجمالي:
${grooms + brides}`,

    Markup.inlineKeyboard([
      [Markup.button.callback("العرسان", "show_grooms_admin")],

      [Markup.button.callback("العرائس", "show_brides_admin")],

      [Markup.button.callback("الإحصائيات", "statistics")],
    ]),
  );
});

bot.action("show_grooms_admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery("غير مسموح");
  }

  await ctx.answerCbQuery();

  const users = getAllUsers("groom");

  if (!users.length) {
    return ctx.reply("لا يوجد عرسان.");
  }

  for (const user of users) {
    await ctx.reply(`

العريس رقم:
${user.id}

الاسم:
${user.first_name}

Username:
${user.username ? "@" + user.username : "لا يوجد"}

Telegram ID:
${user.telegram_id}

الهاتف:
${user.phone}

العمر:
${user.age}

المدينة:
${user.city}

التعليم:
${user.education}

العمل:
${user.job}

الحالة الاجتماعية:
${user.marital_status}

الديانة:
${user.religion}

الطول:
${user.height}

النبذة:
${user.description}
`);
  }
});

// =====================================================
// ADMIN SHOW BRIDES
// =====================================================

bot.action("show_brides_admin", async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery("غير مسموح");
  }

  await ctx.answerCbQuery();

  const users = getAllUsers("bride");

  if (!users.length) {
    return ctx.reply("لا توجد عرائس.");
  }

  for (const user of users) {
    await ctx.reply(`

العروسة رقم:
${user.id}

الاسم:
${user.first_name}

Username:
${user.username ? "@" + user.username : "لا يوجد"}

Telegram ID:
${user.telegram_id}

الهاتف:
${user.phone}

العمر:
${user.age}

المدينة:
${user.city}

التعليم:
${user.education}

العمل:
${user.job}

الحالة الاجتماعية:
${user.marital_status}

الديانة:
${user.religion}

الطول:
${user.height}

النبذة:
${user.description}
`);
  }
});

// =====================================================
// ADMIN ID
// =====================================================

bot.command("id", async (ctx) => {
  await ctx.reply(
    `Telegram ID الخاص بك:

${ctx.from.id}`,
  );
});

// =====================================================
// ERROR HANDLER
// =====================================================

bot.catch((error) => {
  console.error("BOT ERROR:", error);
});

// =====================================================
// START BOT
// =====================================================

bot.launch();

console.log("Marriage Bot is running...");

// =====================================================
// STOP
// =====================================================

process.once("SIGINT", () => bot.stop("SIGINT"));

process.once("SIGTERM", () => bot.stop("SIGTERM"));
