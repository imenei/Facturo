const fs = require("fs-extra");

const frPath = "public/locales/fr/common.json";
const frTranslations = fs.readJSONSync(frPath);

const enTranslations = {};
const arTranslations = {};

// On pourrait utiliser une API de traduction ici. 
// Pour la démo, on fournit des traductions manuelles pour les termes clés.
const dictionary = {
  "dashboard": { en: "Dashboard", ar: "لوحة التحكم" },
  "utilisateurs": { en: "Users", ar: "المستخدمين" },
  "factures": { en: "Invoices", ar: "الفواتير" },
  "livraisons": { en: "Deliveries", ar: "التوصيلات" },
  "t_ches": { en: "Tasks", ar: "المهام" },
  "param_tres": { en: "Settings", ar: "الإعدادات" },
  "profil": { en: "Profile", ar: "الملف الشخصي" },
  "d_connexion": { en: "Logout", ar: "تسجيل الخروج" },
  "ajouter": { en: "Add", ar: "إضافة" },
  "modifier": { en: "Edit", ar: "تعديل" },
  "supprimer": { en: "Delete", ar: "حذف" },
  "sauvegarder": { en: "Save", ar: "حفظ" },
  "annuler": { en: "Cancel", ar: "إلغاء" },
  "nom": { en: "Name", ar: "الاسم" },
  "email": { en: "Email", ar: "البريد الإلكتروني" },
  "t_l_phone": { en: "Phone", ar: "الهاتف" },
  "r_le": { en: "Role", ar: "الدور" },
  "chargement": { en: "Loading...", ar: "جاري التحميل..." },
  "connexion": { en: "Login", ar: "تسجيل الدخول" },
  "mot_de_passe": { en: "Password", ar: "كلمة المرور" },
  "rechercher": { en: "Search", ar: "بحث" },
  "filtrer": { en: "Filter", ar: "تصفية" },
  "tout": { en: "All", ar: "الكل" },
  "statut": { en: "Status", ar: "الحالة" },
  "date": { en: "Date", ar: "التاريخ" },
  "total": { en: "Total", ar: "المجموع" },
  "action": { en: "Action", ar: "الإجراء" },
  "admin": { en: "Admin", ar: "مدير" },
  "commercial": { en: "Sales", ar: "تجاري" },
  "livreur": { en: "Delivery Man", ar: "موصل" },
  "en_attente": { en: "Pending", ar: "في الانتظار" },
  "livr": { en: "Delivered", ar: "تم التوصيل" },
  "non_livr": { en: "Not Delivered", ar: "لم يتم التوصيل" },
  "termin_e": { en: "Completed", ar: "مكتملة" },
  "non_termin_e": { en: "Not Completed", ar: "غير مكتملة" },
  "prix": { en: "Price", ar: "السعر" },
  "remarques": { en: "Remarks", ar: "ملاحظات" },
  "ajouter_une_remarque": { en: "Add a remark", ar: "إضافة ملاحظة" },
  "facturo": { en: "Facturo", ar: "فاكتورو" },
  "gestion_commerciale": { en: "Business Management", ar: "التسيير التجاري" },
  "bienvenue": { en: "Welcome", ar: "مرحباً" },
};

Object.keys(frTranslations).forEach(key => {
  if (dictionary[key]) {
    enTranslations[key] = dictionary[key].en;
    arTranslations[key] = dictionary[key].ar;
  } else {
    // Fallback au français pour les termes non traduits
    enTranslations[key] = frTranslations[key];
    arTranslations[key] = frTranslations[key];
  }
});

fs.writeJSONSync("public/locales/en/common.json", enTranslations, { spaces: 2 });
fs.writeJSONSync("public/locales/ar/common.json", arTranslations, { spaces: 2 });

console.log("✅ Fichiers de traduction EN et AR générés avec succès.");