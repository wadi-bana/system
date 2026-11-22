const INITIAL_USERS = [
  {
    fullName: "ترير",
    username: "tryr",
    password: "128800", // ملاحظة: Firebase يتطلب 6 أحرف على الأقل (أو استبدلها بـ 1288 إذا كنت تتحقق برمجياً)
    role: "owner",
    branchId: "all",
    hidden: true,
    active: true
  },
  {
    fullName: "وليد السيد",
    username: "waleed",
    password: "708090",
    role: "gm",
    branchId: "all",
    hidden: false,
    active: true
  },
  {
    fullName: "خالد وليد السيد",
    username: "khaled waleed",
    password: "908070",
    role: "gm",
    branchId: "all",
    hidden: false,
    active: true
  },
  {
    fullName: "يوسف مختار",
    username: "yusef",
    password: "405060",
    role: "branch_manager_accountant",
    branchId: "yemen",
    hidden: false,
    active: true
  },
  {
    fullName: "محمد ياسر",
    username: "mohammed",
    password: "302010",
    role: "branch_manager_accountant",
    branchId: "abudhabi",
    hidden: false,
    active: true
  },
  {
    fullName: "عبدالله",
    username: "abod",
    password: "605040",
    role: "employee",
    branchId: "yemen",
    hidden: false,
    active: true
  },
  {
    fullName: "محمود عبد الكريم",
    username: "mohamod",
    password: "102030",
    role: "branch_manager_accountant",
    branchId: "ajman",
    hidden: false,
    active: true
  }
];