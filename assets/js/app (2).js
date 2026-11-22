            import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
            import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

            const { jsPDF } = window.jspdf;

            const firebaseConfig = window.firebaseConfig;

            let useFirebase = true;
            let rtdb = null;
            let firebaseInitError = null;
            try {
                const app = initializeApp(firebaseConfig);
                rtdb = getDatabase(app);
            } catch (e) {
                console.error("Firebase initialization failed:", e);
                firebaseInitError = e;
                useFirebase = false;
            }

            let currentUser = null;
            let currentLang = 'ar';
            let cloudUsers = [];
            let cloudUsersLoaded = false;
            let cloudDataLoaded = false;
            let cloudDataExists = false;
            let currentCargoAttachments = [];
            let currentTab = 'dashboard';
            let currentPreviewTicket = null;
            let currentPreviewCargo = null;
            let currentPreviewDebt = null;
            let financeOverrideDepartedTripId = null;

            // دوال توليد أسماء ملفات التذاكر والفواتير حسب النوع والرقم
            function getTicketFileName(ticketObj = null) {
                const t = ticketObj || currentPreviewTicket;
                const num = t && t.id ? String(t.id).trim() : (document.getElementById('imgTicketCode')?.innerText.replace('#', '').trim() || Date.now());
                return `تذكرة ${num}`;
            }

            function getCargoFileName(cargoObj = null) {
                const c = cargoObj || currentPreviewCargo;
                const num = c && c.id ? String(c.id).trim() : (document.getElementById('imgCargoCode')?.innerText.replace('#', '').trim() || Date.now());
                return `فاتورة ${num}`;
            }

            function getDebtFileName(debtObj = null) {
                const d = debtObj || currentPreviewDebt;
                const num = d && d.id ? String(d.id).trim() : (document.getElementById('imgDebtInvCode')?.innerText.replace('#', '').trim() || Date.now());
                return `فاتورة ${num}`;
            }

            // دالة موحدة لترتيب أرقام الفواتير والتذاكر تنازلياً (من الأكبر للأصغر) مع دعم الأرقام والحروف أبجدياً
            function compareInvoiceIdsDesc(a, b) {
                const idA = String(a && a.id !== undefined ? a.id : (a || '')).trim();
                const idB = String(b && b.id !== undefined ? b.id : (b || '')).trim();
                const numA = Number(idA);
                const numB = Number(idB);
                if (!isNaN(numA) && !isNaN(numB) && idA !== '' && idB !== '') {
                    return numB - numA;
                }
                return idB.localeCompare(idA, ['ar', 'en'], { numeric: true, sensitivity: 'base' });
            }

            const DEFAULT_USERS = [
                { username: 'محمود', password: '102030', role: 'مدير عام', branch: 'جميع الفروع', fullName: 'محمود عبد الكريم', active: true, hidden: false },
                { username: 'وليد السيد', password: '708090', role: 'مدير عام', branch: 'جميع الفروع', fullName: 'وليد السيد', active: true, hidden: false },
                { username: 'يوسف', password: '405060', role: 'مدير فرع ومحاسب', branch: 'فرع اليمن', fullName: 'يوسف مختار', active: true, hidden: false }
            ];

            const standardDriverItems = [
                "العهده", "ديزل", "رسوم عبور", "رسوم مخلص جمارك", "رسوم متفرقة",
                "استلام امانات", "تسليم امانات", "ركاب عمان/العين", "ركاب اليمن", "متفرقات", "صيانة", "متبقي حساب"
            ];

            let db = {
                buses: [],
                trips: [
                    { id: "trip_1794143414766", date: "2026-11-11", route: "من الامارات لليمن", busInfo: "باص الرحلة الأساسي (الأربعاء)", status: "مجدولة", createdBy: "محمود" }
                ],
                drivers: [],
                employees: [],
                passengers: [
                    { id: "140", tripId: "trip_1794143414766", agent: "النظام", name: "محسن فيصل احمد", phone: "0508200749", passport: "12605475", passengerCount: 1, extraPassengers: [], origin: "عجمان", destination: "عدن", date: "2026-11-11", reportingTime: "4:00 عصراً", fare: 350, payMethod: "مدفوع", branch: "فرع عجمان", createdBy: "محمود", createdAt: "2026-11-11 10:00", auditLog: [{ action: "إنشاء التذكرة", user: "محمود", time: "2026-11-11 10:00" }] }
                ],
                cargo: [
                    {
                        "id": "150",
                        "tripId": "trip_1794143414766",
                        "date": "2026-11-11",
                        "sender": "احمد منصور",
                        "senderPhone": "0505030704",
                        "senderAddress": "عجمان",
                        "receiver": "عيسى رياض",
                        "receiverPhone": "779883337-783256789",
                        "receiverAddress": "عدن",
                        "items": [
                            { "desc": "كيس فيه فلتر سيارة", "qty": 1, "price": 50 }
                        ],
                        "grandTotal": 50,
                        "paymentStatus": "مدفوع",
                        "branch": "فرع عجمان",
                        "createdBy": "محمود",
                        "createdAt": "2026-11-11 09:00",
                        "auditLog": [{ "action": "إنشاء الفاتورة", "user": "محمود", "time": "2026-11-11 09:00" }]
                    }
                ],
                vouchers: [],
                debtInvoices: [],
                transitVisas: [],
                nextTicketNo: 141,
                nextCargoNo: 158,
                nextDebtInvNo: 2,
                nextTransitNo: 1
            };

            const translations = {
                ar: {
                    htmlDir: 'rtl', htmlLang: 'ar',
                    pageTitle: 'شركة وادي بناء للنقل الدولي | لوحة التحكم والنظام الموحد',
                    lgTitle: 'تسجيل الدخول للنظام الموحد',
                    lgSub: 'أدخل بيانات الحساب المعتمدة للوصول للوحة التحكم',
                    lgUserLbl: 'اسم المستخدم', lgPassLbl: 'كلمة المرور', lgBtn: 'دخول النظام',
                    headTitle: 'شركة وادي بناء للنقل الدولي', headSub: 'النظام الموحد الشامل (Firebase v13.2.0)',
                    btnBackup: 'نسخة JSON', btnBackupPDF: 'نسخة احتياطية PDF', btnRestore: 'استرجاع JSON', btnRestorePDF: 'استعادة من PDF', btnLogout: 'خروج',
                    tDashboard: 'لوحة التحكم', tPassengers: 'التذاكر والركاب', tCargo: 'فواتير الشحن', tFin: 'الإدارة المالية',
                    searchPh: 'بحث ذكي: رقم البوليصة، اسم العميل، أو الصنف...', btnResetSearch: 'إلغاء',
                    lblStat1: 'إجمالي حجوزات الركاب', lblStat3: 'إجمالي المصروفات العامة', lblStat4: 'صافي رصيد الصندوق العام',
                    lblChart1: 'مقارنة الإيرادات والمصروفات المالية', lblChart2: 'نسب حالات سداد الفواتير والتذاكر'
                },
                en: {
                    htmlDir: 'ltr', htmlLang: 'en',
                    pageTitle: 'Wadi Bina Overland Transport | Unified System & Dashboard',
                    lgTitle: 'Unified System Login',
                    lgSub: 'Enter approved credentials to access the control panel',
                    lgUserLbl: 'Username', lgPassLbl: 'Password', lgBtn: 'Login',
                    headTitle: 'Wadi Bina Overland Transport', headSub: 'Comprehensive Unified System (Firebase v13.2.0)',
                    btnBackup: 'JSON Backup', btnBackupPDF: 'PDF Backup', btnRestore: 'Restore JSON', btnRestorePDF: 'Restore PDF', btnLogout: 'Logout',
                    tDashboard: 'Dashboard', tPassengers: 'Tickets & Passengers', tCargo: 'Cargo Invoices', tFin: 'Financial Management',
                    searchPh: 'Smart search: Policy No, Client name, Item...', btnResetSearch: 'Reset',
                    lblStat1: 'Total Passenger Bookings', lblStat3: 'Total General Expenses', lblStat4: 'Net Cash Box Balance',
                    lblChart1: 'Revenue vs Expenses Comparison', lblChart2: 'Invoices & Tickets Payment Status Ratio'
                }
            };

            // ================= دوال التحقق من الصلاحيات =================
            function isMahmoud() {
                if (!currentUser) return false;
                return String(currentUser.username || '').trim() === 'محمود';
            }

            function isMahmoudOrGeneralManager() {
                if (!currentUser) return false;
                return isMahmoud() || ['مالك', 'مدير عام'].includes(currentUser.role);
            }

            function canModifyFinancialsOrAccounts() {
                if (!currentUser) return false;
                return isMahmoudOrGeneralManager() || [
                    'محاسب', 'محاسب رئيسي', 'محاسب فرع', 'مدير فرع ومحاسب'
                ].includes(currentUser.role);
            }

            function isUserAtTripDestinationBranch(trip) {
                if (!currentUser || !trip) return false;
                const userBranch = currentUser.branch || '';
                const r = trip.route || '';
                if (r.includes('لليمن') && !r.startsWith('من اليمن')) {
                    return userBranch === 'فرع اليمن';
                }
                if (r.includes('للامارات')) {
                    return userBranch === 'فرع عجمان' || userBranch === 'فرع ابوظبي';
                }
                if (r.includes('لعمان')) {
                    return userBranch === 'فرع عمان';
                }
                return false;
            }

            function canUserViewDepartedTripRecord(trip) {
                if (!currentUser || !trip) return false;
                if (canModifyFinancialsOrAccounts()) return true;
                return isUserAtTripDestinationBranch(trip);
            }

            function getCurrentUserName() {
                return currentUser ? currentUser.username : 'النظام';
            }

            function getFormattedDateTime() {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const hh = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
            }

            function renderAuditLogIntoBox(auditLog, createdBy, createdAt, containerId) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';
                if (auditLog && auditLog.length > 0) {
                    auditLog.forEach(log => {
                        container.innerHTML += `<div>• <strong>${log.action}</strong> بواسطة (<span class="text-gold">${log.user}</span>) في تاريخ ووقت: <span class="text-amber-300 font-bold">${log.time}</span></div>`;
                    });
                } else {
                    container.innerHTML = `<div>• تم الإنشاء بواسطة (<span class="text-gold">${createdBy || 'النظام'}</span>) في ${createdAt || 'غير محدد'}</div>`;
                }
            }

            function formatPhoneForWhatsApp(phoneStr) {
                if (!phoneStr) return '';
                let cleaned = phoneStr.replace(/\D/g, '');
                if (cleaned.startsWith('05') && cleaned.length === 10) {
                    cleaned = '971' + cleaned.substring(1);
                } else if (cleaned.length === 9 && (cleaned.startsWith('77') || cleaned.startsWith('78') || cleaned.startsWith('73') || cleaned.startsWith('71') || cleaned.startsWith('70'))) {
                    cleaned = '967' + cleaned;
                } else if (cleaned.startsWith('07') && cleaned.length === 10) {
                    cleaned = '967' + cleaned.substring(1);
                }
                return cleaned;
            }

            function getDirectDownloadLink(type, id) {
                const baseUrl = window.location.href.split('?')[0].split('#')[0];
                return `${baseUrl}?dl=${type}&id=${encodeURIComponent(id)}`;
            }

            function sendTicketViaWhatsApp() {
                if (!currentPreviewTicket) return;
                const tkt = currentPreviewTicket;
                const targetPhone = formatPhoneForWhatsApp(tkt.phone);
                if (!targetPhone) { alert('عذراً، رقم هاتف الراكب غير مسجل أو غير صحيح!'); return; }

                const downloadUrl = getDirectDownloadLink('ticket', tkt.id);
                const msgText = `شركة وادي بنا ترحب بكم\n${downloadUrl}`;

                window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msgText)}`, '_blank');
            }

            function sendCargoViaWhatsApp() {
                if (!currentPreviewCargo) return;
                const cargo = currentPreviewCargo;
                const targetPhone = formatPhoneForWhatsApp(cargo.senderPhone);
                if (!targetPhone) { alert('عذراً، رقم هاتف المرسل غير مسجل أو غير صحيح!'); return; }

                const downloadUrl = getDirectDownloadLink('cargo', cargo.id);
                const msgText = `شركة وادي بنا ترحب بكم\n${downloadUrl}`;

                window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msgText)}`, '_blank');
            }

            function downloadTicketImageWithWhatsAppPrompt() {
                if (!currentPreviewTicket) return;
                downloadCapturedImage('ticketCaptureArea', getTicketFileName());
                setTimeout(() => {
                    if (confirm(`تم تحميل صورة (${getTicketFileName()}) بتنسيق A5 بنجاح.\nهل تريد فتح الواتساب لإرسالها للراكب الآن؟`)) {
                        sendTicketViaWhatsApp();
                    }
                }, 800);
            }

            function downloadCargoImageWithWhatsAppPrompt() {
                if (!currentPreviewCargo) return;
                downloadCapturedImage('cargoCaptureArea', getCargoFileName());
                setTimeout(() => {
                    if (confirm(`تم تحميل صورة (${getCargoFileName()}) بتنسيق A5 بنجاح.\nهل تريد فتح الواتساب لإرسالها للمرسل الآن؟`)) {
                        sendCargoViaWhatsApp();
                    }
                }, 800);
            }

            function toggleLanguage() {
                currentLang = currentLang === 'ar' ? 'en' : 'ar';
                applyLanguage();
            }

            function applyLanguage() {
                const t = translations[currentLang];
                document.getElementById('htmlRoot').setAttribute('dir', t.htmlDir);
                document.getElementById('htmlRoot').setAttribute('lang', t.htmlLang);
                document.getElementById('pageTitle').innerText = t.pageTitle;

                for (let key in t) {
                    const el = document.getElementById(key);
                    if (el) {
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            if (el.placeholder) el.placeholder = t[key];
                        } else if (key === 'btnLogout') {
                            el.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> ${t[key]}`;
                        } else {
                            el.innerText = t[key];
                        }
                    }
                }
                document.getElementById('langToggleBtn').innerHTML = currentLang === 'ar' ? '<i class="fa-solid fa-globe"></i> English' : '<i class="fa-solid fa-globe"></i> العربية';
                refreshUI();
            }

            function handleLogin(e) {
                e.preventDefault();
                if (!useFirebase) {
                    showCloudError('تعذر تهيئة Firebase. لا يمكن تسجيل الدخول دون اتصال بالسحابة.');
                    return;
                }
                if (!cloudUsersLoaded || !cloudDataLoaded) {
                    alert('يرجى الانتظار حتى يكتمل تحميل بيانات المستخدمين والنظام من السحابة.');
                    return;
                }
                const uInput = document.getElementById('loginUser').value.trim();
                const pInput = document.getElementById('loginPass').value.trim();
                const found = cloudUsers.find(u => u.username === uInput && u.password === pInput);
                if (found) {
                    if (found.active === false) {
                        alert('تم إيقاف حسابك. يرجى التواصل مع الإدارة.');
                        return;
                    }
                    currentUser = found;
                    if (!cloudDataExists) saveDB(true);
                    document.getElementById('loginOverlay').style.display = 'none';
                    updateUserBadge();
                } else { alert('بيانات الدخول غير صحيحة!'); }
            }

            function handleLogout() {
                currentUser = null;
                location.reload();
            }

            function showCloudError(message) {
                const errorEl = document.getElementById('cloudInitError');
                if (!errorEl) return;
                errorEl.textContent = message;
                errorEl.classList.remove('hidden');
            }

            function updateUserBadge() {
                if (currentUser) {
                    document.getElementById('userInfoBadge').innerText = `${currentUser.username} (${currentUser.role} - ${currentUser.branch || 'فرع عجمان'})`;
                    document.getElementById('loginOverlay').style.display = 'none';

                    const privileged = canModifyFinancialsOrAccounts();
                    const restrictedTabs = ['tab-drivers', 'tab-financials', 'tab-salaries', 'tab-users'];

                    restrictedTabs.forEach(tId => {
                        const el = document.getElementById(tId);
                        if (el) {
                            if (privileged) el.classList.remove('hidden');
                            else el.classList.add('hidden');
                        }
                    });

                    if (privileged || currentUser.role === 'مدير' || currentUser.role === 'مدير فرع') {
                        document.getElementById('managerBranchFilterContainer').classList.remove('hidden');
                    } else {
                        document.getElementById('managerBranchFilterContainer').classList.add('hidden');
                    }

                    // إظهار أو إخفاء نموذج إنشاء/تعديل الرحلة حسب صلاحية محمود أو المدير العام
                    const tripFormBox = document.getElementById('tripForm');
                    if (tripFormBox) {
                        const parentCard = tripFormBox.closest('.bg-cardbg');
                        if (parentCard) {
                            if (isMahmoudOrGeneralManager()) parentCard.classList.remove('hidden');
                            else parentCard.classList.add('hidden');
                        }
                    }

                    const restrictedModules = ['drivers', 'financials', 'salaries', 'users'];
                    if (!privileged && restrictedModules.includes(currentTab)) {
                        switchTab('dashboard');
                    }
                } else {
                    document.getElementById('loginOverlay').style.display = 'flex';
                }
            }

            function openChangePasswordModal() {
                document.getElementById('newPassInput').value = '';
                document.getElementById('changePassModal').classList.remove('hidden');
            }

            function handleUserChangePassword(e) {
                e.preventDefault();
                const newPass = document.getElementById('newPassInput').value.trim();
                if (!newPass) return;

                const users = [...cloudUsers];
                const userObj = users.find(u => u.username === currentUser.username);
                if (userObj) {
                    userObj.password = newPass;
                } else {
                    currentUser.password = newPass;
                    users.push(currentUser);
                }
                currentUser.password = newPass;
                saveCloudUsers(users).then(saved => {
                    if (saved) {
                        writeUserAuditLog('CHANGE_PASSWORD', currentUser.username, { changedBy: currentUser.username });
                        alert('تم تغيير كلمة المرور بنجاح!');
                        closeModal('changePassModal');
                    } else {
                        alert('تم تسجيل تغيير كلمة المرور مؤقتاً في الجلسة، وستتم مزامنته عند عودة الاتصال.');
                    }
                });
            }

            function calculateNextSequenceNumbers() {
                if (db.passengers && db.passengers.length > 0) {
                    let maxTkt = 0;
                    db.passengers.forEach(p => {
                        let val = parseInt(p.id) || 0;
                        if (val > maxTkt) maxTkt = val;
                        if (p.extraPassengers && Array.isArray(p.extraPassengers)) {
                            p.extraPassengers.forEach(ex => {
                                let exVal = parseInt(ex.ticketNo) || 0;
                                if (exVal > maxTkt) maxTkt = exVal;
                            });
                        }
                    });
                    db.nextTicketNo = maxTkt >= 115 ? maxTkt + 1 : 115;
                } else {
                    db.nextTicketNo = 115;
                }

                if (db.cargo && db.cargo.length > 0) {
                    let maxCargo = 0;
                    db.cargo.forEach(c => {
                        let val = parseInt(c.id) || 0;
                        if (val > maxCargo) maxCargo = val;
                    });
                    db.nextCargoNo = maxCargo >= 158 ? maxCargo + 1 : 158;
                } else {
                    db.nextCargoNo = 158;
                }

                if (db.debtInvoices && db.debtInvoices.length > 0) {
                    let maxDebt = 0;
                    db.debtInvoices.forEach(d => {
                        let val = parseInt(d.id) || 0;
                        if (val > maxDebt) maxDebt = val;
                    });
                    db.nextDebtInvNo = maxDebt + 1;
                } else {
                    db.nextDebtInvNo = 1;
                }

                const tktInput = document.getElementById('passTicketNo');
                if (tktInput && !document.getElementById('passEditId').value) tktInput.value = db.nextTicketNo;

                const cargoInput = document.getElementById('cargoInvNo');
                if (cargoInput && !document.getElementById('cargoEditId').value) cargoInput.value = db.nextCargoNo;

                if (db.transitVisas && db.transitVisas.length > 0) {
                    let maxTransit = 0;
                    db.transitVisas.forEach(t => {
                        let val = parseInt(t.id) || 0;
                        if (val > maxTransit) maxTransit = val;
                    });
                    db.nextTransitNo = maxTransit + 1;
                } else {
                    db.nextTransitNo = 1;
                }

                const debtInput = document.getElementById('debtInvNo');
                if (debtInput) debtInput.value = db.nextDebtInvNo;

                const transitInput = document.getElementById('transitInvNo');
                if (transitInput && !document.getElementById('transitEditId').value) {
                    transitInput.value = db.nextTransitNo;
                }
            }

            function validateAndRepairDB() {
                let fixed = false;
                if (!db.buses || !Array.isArray(db.buses)) { db.buses = []; fixed = true; }
                if (!db.trips || !Array.isArray(db.trips)) { db.trips = []; fixed = true; }
                if (!db.drivers || !Array.isArray(db.drivers)) { db.drivers = []; fixed = true; }
                if (!db.employees || !Array.isArray(db.employees)) { db.employees = []; fixed = true; }
                if (!db.passengers || !Array.isArray(db.passengers)) { db.passengers = []; fixed = true; }
                if (!db.cargo || !Array.isArray(db.cargo)) { db.cargo = []; fixed = true; }
                if (!db.vouchers || !Array.isArray(db.vouchers)) { db.vouchers = []; fixed = true; }
                if (!db.debtInvoices || !Array.isArray(db.debtInvoices)) { db.debtInvoices = []; fixed = true; }
                if (!db.transitVisas || !Array.isArray(db.transitVisas)) { db.transitVisas = []; fixed = true; }

                db.passengers.forEach(p => {
                    if (!p.createdAt) { p.createdAt = p.date ? p.date + ' 09:00' : '2026-11-01 09:00'; fixed = true; }
                    if (!p.auditLog) { p.auditLog = [{ action: 'إنشاء التذكرة', user: p.createdBy || 'محمود', time: p.createdAt }]; fixed = true; }
                    if (p.extraPassengers && Array.isArray(p.extraPassengers)) {
                        let baseNum = parseInt(p.id) || 0;
                        p.extraPassengers.forEach((ex, i) => {
                            if (!ex.ticketNo) {
                                ex.ticketNo = baseNum ? String(baseNum + i + 1) : `${p.id}-${i + 1}`;
                                fixed = true;
                            }
                        });
                    }
                });

                db.cargo.forEach(c => {
                    if (!c.createdAt) { c.createdAt = c.date ? c.date + ' 09:00' : '2026-11-01 09:00'; fixed = true; }
                    if (!c.auditLog) { c.auditLog = [{ action: 'إنشاء الفاتورة', user: c.createdBy || 'محمود', time: c.createdAt }]; fixed = true; }
                });

                db.debtInvoices.forEach(d => {
                    if (!d.createdAt) { d.createdAt = d.date ? d.date + ' 09:00' : '2026-11-01 09:00'; fixed = true; }
                    if (!d.auditLog) { d.auditLog = [{ action: 'إنشاء الفاتورة الآجلة', user: d.createdBy || 'محمود', time: d.createdAt }]; fixed = true; }
                });

                db.drivers.forEach(dr => {
                    if (!dr.createdAt) { dr.createdAt = dr.date ? dr.date + ' 09:00' : '2026-11-01 09:00'; fixed = true; }
                    if (!dr.auditLog) { dr.auditLog = [{ action: 'إنشاء حساب السائق', user: dr.createdBy || 'محمود', time: dr.createdAt }]; fixed = true; }
                });

                // ترتيب الفواتير والتذاكر تلقائياً في قاعدة البيانات من الأكبر للأصغر
                db.passengers.sort(compareInvoiceIdsDesc);
                db.cargo.sort(compareInvoiceIdsDesc);
                db.debtInvoices.sort(compareInvoiceIdsDesc);
                db.transitVisas.sort(compareInvoiceIdsDesc);

                calculateNextSequenceNumbers();
                if (fixed) { saveDB(); }
            }

            let isSyncListenerAttached = false;
            let isFirebaseInitialized = false;
            let hasPendingOfflineWrites = false;
            let isApplyingRemote = false;

            function sanitizeForFirebase(obj) {
                return JSON.parse(JSON.stringify(obj, (key, value) => value === undefined ? null : value));
            }

            let hasPendingUsersWrite = false;

            function pushCloudUsers() {
                if (!useFirebase || !rtdb || !navigator.onLine) {
                    hasPendingUsersWrite = true;
                    return Promise.resolve(false);
                }
                return set(ref(rtdb, 'systemUsers'), sanitizeForFirebase(cloudUsers))
                    .then(() => {
                        hasPendingUsersWrite = false;
                        cloudUsersLoaded = true;
                        return true;
                    })
                    .catch(error => {
                        console.error('Users sync push error:', error);
                        hasPendingUsersWrite = true;
                        showCloudError('تعذر مزامنة المستخدمين مع Firebase. ستُعاد المحاولة عند عودة الاتصال.');
                        return false;
                    });
            }

            function saveCloudUsers(users) {
                cloudUsers = users;
                hasPendingUsersWrite = true;
                return pushCloudUsers();
            }

            function writeUserAuditLog(action, targetUsername, details = {}) {
                if (!useFirebase || !rtdb) return Promise.resolve(false);
                const actor = currentUser ? (currentUser.fullName || currentUser.username) : 'النظام';
                const logId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const entry = {
                    actor,
                    actorUsername: currentUser?.username || null,
                    action,
                    targetUsername,
                    details,
                    timestamp: Date.now()
                };
                return set(ref(rtdb, `systemAuditLogs/${logId}`), sanitizeForFirebase(entry))
                    .catch(error => {
                        console.warn('تعذر تسجيل حركة إدارة المستخدمين:', error);
                        return false;
                    });
            }

            function normalizeArray(val) {
                if (!val) return [];
                if (Array.isArray(val)) return val.filter(item => item !== null && item !== undefined);
                if (typeof val === 'object') return Object.values(val).filter(item => item !== null && item !== undefined);
                return [];
            }

            function applyRemoteSnapshot(val) {
                if (!val || isApplyingRemote) return;
                isApplyingRemote = true;
                try {
                    db = {
                        buses: normalizeArray(val.buses),
                        trips: normalizeArray(val.trips),
                        drivers: normalizeArray(val.drivers),
                        employees: normalizeArray(val.employees),
                        passengers: normalizeArray(val.passengers),
                        cargo: normalizeArray(val.cargo),
                        vouchers: normalizeArray(val.vouchers),
                        debtInvoices: normalizeArray(val.debtInvoices),
                        transitVisas: normalizeArray(val.transitVisas),
                        nextTicketNo: val.nextTicketNo || 141,
                        nextCargoNo: val.nextCargoNo || 158,
                        nextDebtInvNo: val.nextDebtInvNo || 2,
                        nextTransitNo: val.nextTransitNo || 1,
                        _lastUpdated: val._lastUpdated || Date.now()
                    };
                    validateAndRepairDB();
                    refreshUI();
                    cloudDataLoaded = true;
                    checkAutoDownloadFromUrl();
                } finally {
                    isApplyingRemote = false;
                }
            }

            function pushLocalToFirebase() {
                if (!useFirebase || !rtdb || !navigator.onLine) {
                    hasPendingOfflineWrites = true;
                    return Promise.resolve(false);
                }
                const cleanPayload = sanitizeForFirebase(db);
                return set(ref(rtdb, 'systemUnifiedData'), cleanPayload)
                    .then(() => {
                        hasPendingOfflineWrites = false;
                        return true;
                    })
                    .catch(err => {
                        console.error("Sync push error:", err);
                        hasPendingOfflineWrites = true;
                        showCloudError('تعذر مزامنة التغييرات مع Firebase. ستُعاد المحاولة عند عودة الاتصال.');
                        return false;
                    });
            }

            function forcePullFromFirebase() {
                if (!useFirebase || !rtdb || !navigator.onLine) return;
                if (hasPendingOfflineWrites) {
                    pushLocalToFirebase();
                    return;
                }
                get(ref(rtdb, 'systemUnifiedData')).then((snapshot) => {
                    if (snapshot.exists()) {
                        const remoteVal = snapshot.val();
                        const remoteTs = remoteVal._lastUpdated || 0;
                        const localTs = db._lastUpdated || 0;
                        if (remoteTs >= localTs || !localTs) {
                            applyRemoteSnapshot(remoteVal);
                        } else {
                            pushLocalToFirebase();
                        }
                    }
                }).catch(err => console.warn("Force pull error:", err));
            }

            function initSync() {
                if (!useFirebase || !rtdb) {
                    showCloudError('تعذر تهيئة Firebase. لم يتم تحميل بيانات محلية كبديل.');
                    return;
                }
                if (isFirebaseInitialized) {
                    forcePullFromFirebase();
                    return;
                }
                isFirebaseInitialized = true;

                onValue(ref(rtdb, '.info/connected'), (snap) => {
                    if (snap.val() === true) {
                        if (hasPendingUsersWrite) pushCloudUsers();
                        if (hasPendingOfflineWrites) {
                            pushLocalToFirebase();
                        } else {
                            forcePullFromFirebase();
                        }
                    }
                });

                onValue(ref(rtdb, 'systemUsers'), (snapshot) => {
                    const val = snapshot.val();
                    if (val) {
                        if (hasPendingUsersWrite) {
                            pushCloudUsers();
                            return;
                        }
                        cloudUsers = normalizeArray(val);
                        if (cloudUsers.length) {
                            cloudUsersLoaded = true;
                            document.getElementById('cloudInitError')?.classList.add('hidden');
                            if (currentTab === 'users' && canModifyFinancialsOrAccounts()) renderUsersTable();
                        } else {
                            saveCloudUsers([...DEFAULT_USERS]);
                        }
                    } else {
                        saveCloudUsers([...DEFAULT_USERS]);
                    }
                }, (error) => {
                    console.error("Users sync error:", error);
                    showCloudError('تعذر تحميل المستخدمين من Firebase.');
                });

                onValue(ref(rtdb, 'systemUnifiedData'), (snapshot) => {
                    const val = snapshot.val();
                    if (val) {
                        cloudDataExists = true;
                        cloudDataLoaded = true;
                        if (hasPendingOfflineWrites) {
                            pushLocalToFirebase();
                        } else {
                            applyRemoteSnapshot(val);
                        }
                    } else {
                        cloudDataExists = false;
                        cloudDataLoaded = true;
                        refreshUI();
                    }
                }, (error) => {
                    console.error("Firebase Sync Error:", error);
                    showCloudError('تعذر تحميل بيانات النظام من Firebase.');
                });

                if (!isSyncListenerAttached) {
                    isSyncListenerAttached = true;
                    document.addEventListener("visibilitychange", () => {
                        if (!document.hidden) forcePullFromFirebase();
                    });
                    window.addEventListener("focus", () => forcePullFromFirebase());
                    window.addEventListener("online", () => {
                        if (hasPendingOfflineWrites) {
                            pushLocalToFirebase();
                        } else {
                            forcePullFromFirebase();
                        }
                    });
                }
            }

            function saveDB(forceImmediate = false) {
                if (isApplyingRemote && !forceImmediate && !isMahmoud()) return;
                calculateNextSequenceNumbers();
                db._lastUpdated = Date.now();
                if (isMahmoud()) {
                    db._lastMahmoudOverride = Date.now();
                }
                hasPendingOfflineWrites = true;
                if (useFirebase && rtdb) pushLocalToFirebase();
                else showCloudError('لا يمكن حفظ التغييرات لأن Firebase غير متاح.');
            }

            let forcedDeviceMode = 'auto';

            function detectAndApplyDeviceLayout() {
                const root = document.getElementById('htmlRoot');
                const label = document.getElementById('deviceModeLabel');
                const btn = document.getElementById('deviceModeBtn');
                const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const isSmallScreen = window.innerWidth <= 820;
                const useMobile = forcedDeviceMode === 'mobile' || (forcedDeviceMode === 'auto' && (isMobileUA || isSmallScreen));

                if (useMobile) {
                    root.classList.add('device-mobile');
                    root.classList.remove('device-desktop');
                    if (label) label.innerText = 'وضع الأندرويد';
                    if (btn) btn.innerHTML = '<i class="fa-brands fa-android"></i> <span id="deviceModeLabel">وضع الأندرويد</span>';
                } else {
                    root.classList.add('device-desktop');
                    root.classList.remove('device-mobile');
                    if (label) label.innerText = 'وضع الديسك توب';
                    if (btn) btn.innerHTML = '<i class="fa-solid fa-desktop"></i> <span id="deviceModeLabel">وضع الديسك توب</span>';
                }
            }

            function toggleDeviceLayoutMode() {
                const root = document.getElementById('htmlRoot');
                forcedDeviceMode = root.classList.contains('device-mobile') ? 'desktop' : 'mobile';
                detectAndApplyDeviceLayout();
            }

            window.addEventListener('resize', () => {
                if (forcedDeviceMode === 'auto') detectAndApplyDeviceLayout();
            });

            function toggleSidebar() {
                const sidebar = document.getElementById('appSidebar');
                const wrapper = document.getElementById('mainContentWrapper');
                const overlay = document.getElementById('sidebarOverlay');

                if (window.innerWidth >= 1024) {
                    sidebar.classList.toggle('collapsed');
                    wrapper.style.marginRight = sidebar.classList.contains('collapsed') ? '0px' : '256px';
                } else {
                    sidebar.classList.toggle('mobile-open');
                    overlay.classList.toggle('hidden', !sidebar.classList.contains('mobile-open'));
                }
            }

            window.onload = function () {
                detectAndApplyDeviceLayout();
                updateUserBadge();
                applyLanguage();
                const todayStr = new Date().toISOString().split('T')[0];
                document.getElementById('passDate').value = todayStr;
                document.getElementById('drvDate').value = todayStr;
                document.getElementById('vDate').value = todayStr;
                document.getElementById('debtInvDate').value = todayStr;
                document.getElementById('advDate').value = todayStr;
                if (document.getElementById('dailyCloseDate')) document.getElementById('dailyCloseDate').value = todayStr;
                calculateNextSequenceNumbers();
                onPassengerCountChanged();
                updateReportingTimeAutomatically();
                addCargoItemRow();
                buildDriverItemsRows();
                initSync();
                checkAutoDownloadFromUrl();
            };

            let autoDownloadHandled = false;
            function checkAutoDownloadFromUrl() {
                if (autoDownloadHandled) return;
                const params = new URLSearchParams(window.location.search);
                const dlType = params.get('dl');
                const dlId = params.get('id');
                if (!dlType || !dlId) return;

                if (dlType === 'ticket') {
                    const tkt = (db.passengers || []).find(x => String(x.id) === String(dlId));
                    if (tkt) {
                        autoDownloadHandled = true;
                        document.getElementById('loginOverlay').style.display = 'none';
                        previewTicketImage(tkt.id);
                        setTimeout(() => {
                            downloadCapturedImage('ticketCaptureArea', getTicketFileName(tkt));
                        }, 700);
                    }
                } else if (dlType === 'cargo') {
                    const crg = (db.cargo || []).find(x => String(x.id) === String(dlId));
                    if (crg) {
                        autoDownloadHandled = true;
                        document.getElementById('loginOverlay').style.display = 'none';
                        previewCargoImage(crg.id);
                        setTimeout(() => {
                            downloadCapturedImage('cargoCaptureArea', getCargoFileName(crg));
                        }, 700);
                    }
                }
            }

            function switchTab(tabId) {
                const restrictedModules = ['drivers', 'financials', 'salaries', 'users'];
                if (restrictedModules.includes(tabId) && !canModifyFinancialsOrAccounts()) {
                    alert('عذراً، هذا القسم مخصص للمستخدم محمود، المدير العام، والمحاسب فقط!');
                    return;
                }
                currentTab = tabId;
                document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
                document.getElementById(`module-${tabId}`).classList.remove('hidden');
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    const isHidden = btn.classList.contains('hidden');
                    btn.className = `tab-btn w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition bg-zinc-800/80 text-zinc-300 hover:text-gold hover:bg-zinc-800 text-right ${isHidden ? 'hidden' : ''}`;
                });
                const activeBtn = document.getElementById(`tab-${tabId}`);
                if (activeBtn) {
                    activeBtn.className = "tab-btn w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition gold-gradient-bg text-black shadow text-right";
                }
                refreshUI();
            }

            function switchFinancialSubTab(subId) {
                if (!canModifyFinancialsOrAccounts()) {
                    alert('عذراً، التعديل في الحسابات مسموح فقط لمحمود، المدير العام، أو المحاسب!');
                    return;
                }
                if (subId === 'create-debt-inv') {
                    calculateNextSequenceNumbers();
                    document.getElementById('fin-sub-debts').classList.add('hidden');
                    document.getElementById('fin-sub-create-debt-inv').classList.remove('hidden');
                } else {
                    document.getElementById('fin-sub-debts').classList.remove('hidden');
                    document.getElementById('fin-sub-create-debt-inv').classList.add('hidden');
                }
            }

            function refreshUI() {
                handleGlobalSearch();
                renderDashboardData();
                populateBusDriversDropdown();
                renderBusesTable();
                populateTripBusesDropdown();
                renderTripsTable();
                renderDriversTable();
                renderEmployeesSalaryTable();
                populateAdvanceEmployeesDropdown();
                renderFinancialLog();
                renderTransitTable();
                populateTripsDropdown();
                if (currentTab === 'financials') {
                    renderFinancials();
                    renderVouchersTable();
                    renderDebtInvoicesTable();
                }
                if (currentTab === 'users' && canModifyFinancialsOrAccounts()) {
                    renderUsersTable();
                }
            }

            let finBarChartInstance = null;
            let payPieChartInstance = null;

            function getFilteredData(list) {
                if (!currentUser) return list;
                if (!canModifyFinancialsOrAccounts() && currentUser.role !== 'مدير') {
                    const userBranch = currentUser.branch || 'فرع عجمان';
                    return list.filter(item => {
                        if (item.tripId) {
                            const trip = (db.trips || []).find(t => String(t.id) === String(item.tripId));
                            if (trip && trip.status === 'غادرت الرحلة' && isUserAtTripDestinationBranch(trip)) {
                                return true;
                            }
                        }
                        return item.branch === userBranch;
                    });
                }
                const branchSelect = document.getElementById('selectedManagerBranch');
                const selectedBranch = branchSelect ? branchSelect.value : 'ALL';
                if (selectedBranch === 'ALL') return list;
                return list.filter(item => item.branch === selectedBranch);
            }

            function renderDashboardData() {
                const filteredPass = getFilteredData(db.passengers);
                const filteredCargo = getFilteredData(db.cargo);
                const filteredVouchers = getFilteredData(db.vouchers);
                const filteredDrivers = getFilteredData(db.drivers);

                const totalPassengersCount = filteredPass.length;
                const totalCargoRev = filteredCargo.filter(c => c.paymentStatus === 'مدفوع').reduce((s, c) => s + c.grandTotal, 0);
                const totalTicketRev = filteredPass.filter(p => p.payMethod === 'مدفوع').reduce((s, p) => s + (p.fare || 0), 0);
                const totalTransitRev = getFilteredData(db.transitVisas || []).filter(t => t.paymentStatus === 'تم الدفع والاصدار').reduce((s, t) => s + (t.amount || 0), 0);

                const totalDriversExp = filteredDrivers.reduce((s, d) => s + (d.totalExpenses || 0), 0);
                const totalVoucherExp = filteredVouchers.filter(v => v.type === 'صرف').reduce((s, v) => s + v.amount, 0);
                const totalExpenses = totalDriversExp + totalVoucherExp;

                const totalVoucherRec = filteredVouchers.filter(v => v.type === 'قبض').reduce((s, v) => s + v.amount, 0);
                const netBox = (totalTicketRev + totalCargoRev + totalTransitRev + totalVoucherRec) - totalExpenses;

                document.getElementById('dashTotalPassengers').innerText = totalPassengersCount;
                document.getElementById('dashTotalDriversExp').innerText = `${totalDriversExp} AED`;
                document.getElementById('dashTotalExpenses').innerText = `${totalExpenses} AED`;
                document.getElementById('dashNetProfit').innerText = `${netBox} AED`;

                const ctxBar = document.getElementById('financialBarChart');
                if (ctxBar) {
                    if (finBarChartInstance) finBarChartInstance.destroy();
                    finBarChartInstance = new Chart(ctxBar.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: ['تذاكر مدفوعة', 'شحن مدفوع', 'المصروفات', 'الصندوق'],
                            datasets: [{
                                label: 'المبلغ (درهم)',
                                data: [totalTicketRev, totalCargoRev, totalExpenses, netBox],
                                backgroundColor: ['#D4AF37', '#10b981', '#ef4444', '#f59e0b'],
                                borderRadius: 8
                            }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    });
                }

                const paidCount = filteredPass.filter(p => p.payMethod === 'مدفوع').length + filteredCargo.filter(c => c.paymentStatus === 'مدفوع').length;
                const unpaidCount = (filteredPass.length + filteredCargo.length) - paidCount;

                const ctxPie = document.getElementById('paymentStatusPieChart');
                if (ctxPie) {
                    if (payPieChartInstance) payPieChartInstance.destroy();
                    payPieChartInstance = new Chart(ctxPie.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: ['مدفوع', 'آجل / غير مدفوع'],
                            datasets: [{ data: [paidCount, unpaidCount], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0 }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                    });
                }
            }

            // ================= إدارة الرواتب والموظفين والسلفيات =================
            function onEmpRoleTypeChange() {
                const roleType = document.getElementById('empRoleType').value;
                const rateLbl = document.getElementById('empBaseRateLabel');
                const unitsLbl = document.getElementById('empWorkUnitsLabel');
                const rateInput = document.getElementById('empBaseRate');

                if (roleType === 'سائق') {
                    rateLbl.innerText = 'أجر الرحلة الواحدة (درهم) *';
                    unitsLbl.innerText = 'عدد الرحلات المستحقة *';
                    if (!document.getElementById('empEditId').value) rateInput.value = 2000;
                } else {
                    rateLbl.innerText = 'المرتب الشهري الأساسي (درهم) *';
                    unitsLbl.innerText = 'عدد الأشهر المستحقة *';
                    if (!document.getElementById('empEditId').value) rateInput.value = 3000;
                }
            }

            function handleSaveEmployee(e) {
                e.preventDefault();
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالتعديل في الحسابات والرواتب!'); return; }
                if (!db.employees) db.employees = [];
                const editId = document.getElementById('empEditId').value;
                const name = document.getElementById('empName').value.trim();
                const roleType = document.getElementById('empRoleType').value;
                const baseRate = parseFloat(document.getElementById('empBaseRate').value) || 0;
                const workUnits = parseFloat(document.getElementById('empWorkUnits').value) || 0;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();

                if (editId) {
                    const idx = db.employees.findIndex(x => x.id === editId);
                    if (idx !== -1) {
                        let emp = db.employees[idx];
                        emp.name = name;
                        emp.roleType = roleType;
                        emp.baseRate = baseRate;
                        emp.workUnits = workUnits;
                        if (!emp.auditLog) emp.auditLog = [{ action: 'إنشاء السجل', user: emp.createdBy || author, time: emp.createdAt || nowStr }];
                        emp.auditLog.push({ action: 'تعديل بيانات الموظف/السائق', user: author, time: nowStr });
                    }
                    alert('تم تحديث بيانات الموظف / السائق بنجاح!');
                    resetEmployeeForm();
                } else {
                    const newEmp = {
                        id: 'emp_' + Date.now(),
                        name: name,
                        roleType: roleType,
                        baseRate: baseRate,
                        workUnits: workUnits,
                        advances: 0,
                        branch: currentUser ? (currentUser.branch || 'فرع عجمان') : 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr,
                        auditLog: [{ action: 'إضافة موظف/سائق', user: author, time: nowStr }]
                    };
                    db.employees.unshift(newEmp);
                    alert('تم إضافة الموظف / السائق بنجاح!');
                    resetEmployeeForm();
                }
                saveDB();
                refreshUI();
            }

            function editEmployee(id) {
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالتعديل في الحسابات والرواتب!'); return; }
                const emp = (db.employees || []).find(x => x.id === id);
                if (!emp) return;
                document.getElementById('empEditId').value = emp.id;
                document.getElementById('empName').value = emp.name;
                document.getElementById('empRoleType').value = emp.roleType;
                onEmpRoleTypeChange();
                document.getElementById('empBaseRate').value = emp.baseRate;
                document.getElementById('empWorkUnits').value = emp.workUnits;

                document.getElementById('empFormTitle').innerText = `تعديل بيانات: ${emp.name}`;
                document.getElementById('empSubmitBtn').innerText = 'حفظ التعديلات';
                document.getElementById('cancelEditEmpBtn').classList.remove('hidden');

                document.getElementById('empEditAuditBox').classList.remove('hidden');
                renderAuditLogIntoBox(emp.auditLog, emp.createdBy, emp.createdAt, 'empEditAuditList');
            }

            function resetEmployeeForm() {
                document.getElementById('employeeForm').reset();
                document.getElementById('empEditId').value = '';
                onEmpRoleTypeChange();
                document.getElementById('empFormTitle').innerText = 'إضافة موظف أو سائق جديد';
                document.getElementById('empSubmitBtn').innerText = 'حفظ بيانات الموظف / السائق';
                document.getElementById('cancelEditEmpBtn').classList.add('hidden');
                document.getElementById('empEditAuditBox').classList.add('hidden');
            }

            function deleteEmployee(idx) {
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالحذف!'); return; }
                db.employees.splice(idx, 1);
                saveDB();
                refreshUI();
            }

            function populateAdvanceEmployeesDropdown() {
                const sel = document.getElementById('advEmpSelect');
                if (!sel) return;
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">-- اختر الموظف أو السائق --</option>';
                const list = getFilteredData(db.employees || []);
                list.forEach(emp => {
                    const opt = document.createElement('option');
                    opt.value = emp.id;
                    opt.textContent = `${emp.name} (${emp.roleType})`;
                    sel.appendChild(opt);
                });
                if (currentVal) sel.value = currentVal;
            }

            function handleSaveAdvance(e) {
                e.preventDefault();
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بإصدار السلف!'); return; }
                const empId = document.getElementById('advEmpSelect').value;
                const amount = parseFloat(document.getElementById('advAmount').value) || 0;
                const date = document.getElementById('advDate').value || new Date().toISOString().split('T')[0];
                const note = document.getElementById('advNote').value.trim();

                if (!empId || amount <= 0) {
                    alert('يرجى اختيار الموظف/السائق وإدخال مبلغ سلفة صحيح!');
                    return;
                }

                const idx = (db.employees || []).findIndex(x => x.id === empId);
                if (idx === -1) return;

                const emp = db.employees[idx];
                emp.advances = (emp.advances || 0) + amount;

                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                if (!emp.auditLog) emp.auditLog = [];
                emp.auditLog.push({ action: `صرف سلفة بقيمة ${amount} AED`, user: author, time: nowStr });

                const voucher = {
                    id: Date.now().toString(),
                    type: 'صرف',
                    date: date,
                    amount: amount,
                    receiver: emp.name,
                    desc: `سند سلفة (${emp.roleType}) ${note ? '- ' + note : ''}`,
                    user: author,
                    createdBy: author,
                    branch: emp.branch || (currentUser ? currentUser.branch : 'فرع عجمان')
                };
                db.vouchers.unshift(voucher);

                saveDB();
                document.getElementById('advanceForm').reset();
                document.getElementById('advDate').value = new Date().toISOString().split('T')[0];
                refreshUI();
                alert(`تم إصدار سند سلفة بقيمة ${amount} AED باسم (${emp.name}) وتم خصمها من حسابه تلقائياً!`);
            }

            function handleCashReceiptForEmployee(empId) {
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بصرف الرواتب!'); return; }
                const idx = (db.employees || []).findIndex(x => x.id === empId);
                if (idx === -1) return;

                const emp = db.employees[idx];
                const gross = (emp.baseRate || 0) * (emp.workUnits || 0);
                const advances = emp.advances || 0;
                const netPayable = gross - advances;

                if (netPayable <= 0) {
                    alert(`لا يوجد رصيد موجب مستحق للصرف لـ (${emp.name}). الصافي الحالي: ${netPayable} AED`);
                    return;
                }

                if (!confirm(`تأكيد استلام نقدي:\nسيتم تسجيل سند صرف رسمي بقيمة (${netPayable} AED) باسم (${emp.name}) وتصفير رصيد المستحقات والسلفيات. هل تريد المتابعة؟`)) {
                    return;
                }

                const nowStr = getFormattedDateTime();
                const todayStr = new Date().toISOString().split('T')[0];
                const author = getCurrentUserName();

                const voucher = {
                    id: Date.now().toString(),
                    type: 'صرف',
                    date: todayStr,
                    amount: netPayable,
                    receiver: emp.name,
                    desc: emp.roleType === 'سائق'
                        ? `استلام نقدي مستحقات رحلات السائق (${emp.workUnits} رحلات بعد خصم سلف ${advances} AED)`
                        : `استلام نقدي راتب شهري للموظف (${emp.workUnits} شهر بعد خصم سلف ${advances} AED)`,
                    user: author,
                    createdBy: author,
                    branch: emp.branch || (currentUser ? currentUser.branch : 'فرع عجمان')
                };
                db.vouchers.unshift(voucher);

                emp.workUnits = 0;
                emp.advances = 0;
                if (!emp.auditLog) emp.auditLog = [];
                emp.auditLog.push({ action: `استلام نقدي وتسجيل سند صرف بقيمة ${netPayable} AED`, user: author, time: nowStr });

                saveDB();
                refreshUI();
                alert(`تم تسجيل سند صرف رسمي باسم (${emp.name}) بمبلغ ${netPayable} AED وتصفية حسابه بنجاح!`);
            }

            function renderEmployeesSalaryTable() {
                const tbody = document.querySelector('#employeesSalaryTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const list = getFilteredData(db.employees || []);
                list.forEach(emp => {
                    const realIdx = db.employees.findIndex(x => x.id === emp.id);
                    const gross = (emp.baseRate || 0) * (emp.workUnits || 0);
                    const advances = emp.advances || 0;
                    const net = gross - advances;

                    const roleBadge = emp.roleType === 'سائق'
                        ? `<span class="bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-xs font-bold">🚌 سائق (بالرحلة)</span>`
                        : `<span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">💼 موظف (شهري)</span>`;

                    const unitText = emp.roleType === 'سائق' ? `${emp.workUnits} رحلة` : `${emp.workUnits} شهر`;

                    tbody.insertRow().innerHTML = `
                    <td><strong>${emp.name}</strong></td>
                    <td>${roleBadge}</td>
                    <td>${emp.baseRate} AED</td>
                    <td class="font-bold text-indigo-300">${unitText}</td>
                    <td class="font-bold text-zinc-200">${gross} AED</td>
                    <td class="font-bold text-red-400">-${advances} AED</td>
                    <td class="font-black ${net >= 0 ? 'text-emerald-400' : 'text-red-500'}">${net} AED</td>
                    <td><span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">${emp.branch || 'فرع عجمان'}</span></td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="handleCashReceiptForEmployee('${emp.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-bold shadow">
                            <i class="fa-solid fa-money-bill-wave ml-1"></i> استلام نقدي
                        </button>
                        <button onclick="editEmployee('${emp.id}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteEmployee(${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                });
            }

            // ================= حسابات السائقين =================
            function buildDriverItemsRows(existingItems = null) {
                const container = document.getElementById('driverItemsRowsContainer');
                if (!container) return;
                container.innerHTML = '';
                standardDriverItems.forEach((desc, idx) => {
                    let rohaVal = 0;
                    let rajahVal = 0;
                    let noteVal = '';
                    if (existingItems && existingItems[idx]) {
                        rohaVal = existingItems[idx].roha || 0;
                        rajahVal = existingItems[idx].rajah || 0;
                        noteVal = existingItems[idx].note || '';
                    }
                    const tr = document.createElement('tr');
                    tr.className = "border-b border-zinc-800/60";
                    tr.innerHTML = `
                    <td class="p-2 font-bold text-zinc-200 driver-item-desc">${desc}</td>
                    <td class="p-2"><input type="number" step="any" value="${rohaVal}" class="drv-roha w-full bg-darkbg border border-zinc-700 rounded p-1.5 text-xs text-center text-zinc-200" oninput="calculateDriverNet()"></td>
                    <td class="p-2"><input type="number" step="any" value="${rajahVal}" class="drv-rajah w-full bg-darkbg border border-zinc-700 rounded p-1.5 text-xs text-center text-zinc-200" oninput="calculateDriverNet()"></td>
                    <td class="p-2"><input type="text" value="${noteVal}" placeholder="ملاحظات..." class="drv-note w-full bg-darkbg border border-zinc-700 rounded p-1.5 text-xs text-zinc-200"></td>
                `;
                    container.appendChild(tr);
                });
                calculateDriverNet();
            }

            function calculateDriverNet() {
                let totalRoha = 0;
                let totalRajah = 0;
                const rows = document.querySelectorAll('#driverItemsRowsContainer tr');
                rows.forEach(tr => {
                    const roha = parseFloat(tr.querySelector('.drv-roha').value) || 0;
                    const rajah = parseFloat(tr.querySelector('.drv-rajah').value) || 0;
                    totalRoha += roha;
                    totalRajah += rajah;
                });

                const formTotalRohaEl = document.getElementById('formTotalRoha');
                const formTotalRajahEl = document.getElementById('formTotalRajah');
                if (formTotalRohaEl) formTotalRohaEl.innerText = totalRoha;
                if (formTotalRajahEl) formTotalRajahEl.innerText = totalRajah;

                const tripDue = parseFloat(document.getElementById('drvTripDue').value) || 0;
                const remaining = parseFloat(document.getElementById('drvRemaining').value) || 0;
                let net = tripDue - remaining;
                document.getElementById('drvNetDue').value = `${net} AED`;
            }

            function handleSaveDriverAccount(e) {
                e.preventDefault();
                if (!canModifyFinancialsOrAccounts()) { alert('عذراً، التعديل في الحسابات مسموح فقط لمحمود، المدير العام، أو المحاسب!'); return; }
                const editId = document.getElementById('driverEditId').value;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();

                let items = [];
                let totalDriverExpenses = 0;
                const rows = document.querySelectorAll('#driverItemsRowsContainer tr');
                rows.forEach(tr => {
                    const roha = parseFloat(tr.querySelector('.drv-roha').value) || 0;
                    const rajah = parseFloat(tr.querySelector('.drv-rajah').value) || 0;
                    totalDriverExpenses += (roha + rajah);
                    items.push({
                        desc: tr.querySelector('.driver-item-desc').innerText,
                        roha: roha,
                        rajah: rajah,
                        note: tr.querySelector('.drv-note').value || '-'
                    });
                });

                const tripDue = parseFloat(document.getElementById('drvTripDue').value) || 0;
                const remaining = parseFloat(document.getElementById('drvRemaining').value) || 0;
                const driverName = document.getElementById('drvName').value;
                const busNo = document.getElementById('drvBusNo').value;
                const date = document.getElementById('drvDate').value;

                if (editId) {
                    const idx = db.drivers.findIndex(d => d.id === editId);
                    if (idx !== -1) {
                        let rec = db.drivers[idx];
                        rec.date = date;
                        rec.busNo = busNo;
                        rec.driverName = driverName;
                        rec.items = items;
                        rec.totalExpenses = totalDriverExpenses;
                        rec.tripDue = tripDue;
                        rec.remaining = remaining;
                        rec.netDue = tripDue - remaining;
                        if (!rec.auditLog) rec.auditLog = [{ action: 'إنشاء', user: rec.createdBy || author, time: rec.createdAt || nowStr }];
                        rec.auditLog.push({ action: 'تعديل حساب السائق', user: author, time: nowStr });
                    }
                    alert('تم تحديث حساب السائق وترحيل المصروفات للصندوق بنجاح!');
                    resetDriverForm();
                } else {
                    const record = {
                        id: 'drv_' + Date.now(),
                        date: date,
                        busNo: busNo,
                        driverName: driverName,
                        items: items,
                        totalExpenses: totalDriverExpenses,
                        tripDue: tripDue,
                        remaining: remaining,
                        netDue: tripDue - remaining,
                        branch: currentUser.branch || 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr,
                        auditLog: [{ action: 'إنشاء حساب السائق', user: author, time: nowStr }]
                    };
                    db.drivers.unshift(record);
                    alert('تم حفظ وتسجيل حساب السائق وترحيل مصروفات الرحلة تلقائياً إلى الصندوق المالي!');
                    document.getElementById('driverForm').reset();
                    document.getElementById('drvDate').value = new Date().toISOString().split('T')[0];
                    buildDriverItemsRows();
                }
                saveDB();
                refreshUI();
            }

            function renderDriversTable() {
                const tbody = document.querySelector('#driversTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                let filteredDrivers = getFilteredData(db.drivers);
                filteredDrivers.sort((a, b) => b.id.localeCompare(a.id));

                filteredDrivers.forEach((d, idx) => {
                    const realIdx = db.drivers.findIndex(x => x.id === d.id);
                    tbody.insertRow().innerHTML = `
                    <td><strong>#${filteredDrivers.length - idx}</strong></td>
                    <td><strong class="text-gold">${d.date}</strong></td>
                    <td>${d.busNo}</td>
                    <td><strong>${d.driverName}</strong></td>
                    <td class="text-red-400 font-bold">${d.totalExpenses || 0} AED</td>
                    <td class="text-emerald-400 font-bold">${d.netDue} AED</td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="previewDriverAccount('${d.id}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-pdf"></i> معاينة وطباعة</button>
                        <button onclick="editDriverAccount('${d.id}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteDriverAccount(${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                });
            }

            function renderFinancialLog() {
                const tbody = document.querySelector('#expensesLogTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const filteredDrivers = getFilteredData(db.drivers);
                filteredDrivers.forEach(d => {
                    d.items.forEach(it => {
                        let itemTotal = (it.roha || 0) + (it.rajah || 0);
                        if (itemTotal > 0) {
                            tbody.insertRow().innerHTML = `
                            <td><span class="bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-xs font-bold">رحلة سائق (${d.driverName} - ${it.desc})</span></td>
                            <td>${d.date}</td>
                            <td>باص: ${d.busNo} | ملاحظات: ${it.note} (الروحة: ${it.roha}, الرجعة: ${it.rajah})</td>
                            <td class="text-red-400 font-bold">${itemTotal} AED</td>
                            <td>${d.branch}</td>
                        `;
                        }
                    });
                });
            }

            function previewDriverAccount(id) {
                const d = db.drivers.find(x => x.id === id);
                if (!d) return;
                document.getElementById('prDriverBus').innerText = d.busNo;
                document.getElementById('prDriverName').innerText = d.driverName;
                document.getElementById('prDriverDate').innerText = d.date;
                document.getElementById('prDriverTotalExp').innerText = `${d.totalExpenses || 0} AED`;
                document.getElementById('prDriverTripDue').innerText = `${d.tripDue} AED`;
                document.getElementById('prDriverRemaining').innerText = `${d.remaining} AED`;
                document.getElementById('prDriverNetDue').innerText = `${d.netDue} AED`;

                let sumRoha = 0;
                let sumRajah = 0;
                const tbody = document.getElementById('prDriverItemsTableBody');
                tbody.innerHTML = '';
                d.items.forEach(it => {
                    sumRoha += (it.roha || 0);
                    sumRajah += (it.rajah || 0);
                    tbody.insertRow().innerHTML = `
                    <td class="border border-slate-300 p-2 font-bold">${it.desc}</td>
                    <td class="border border-slate-300 p-2 text-center">${it.roha}</td>
                    <td class="border border-slate-300 p-2 text-center">${it.rajah}</td>
                    <td class="border border-slate-300 p-2 text-xs">${it.note}</td>
                `;
                });

                const prTotalRohaEl = document.getElementById('prTotalRoha');
                const prTotalRajahEl = document.getElementById('prTotalRajah');
                if (prTotalRohaEl) prTotalRohaEl.innerText = sumRoha;
                if (prTotalRajahEl) prTotalRajahEl.innerText = sumRajah;

                document.getElementById('driverAccountModal').classList.remove('hidden');
            }

            function editDriverAccount(id) {
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالتعديل في الحسابات!'); return; }
                const d = db.drivers.find(x => x.id === id);
                if (!d) return;
                document.getElementById('driverEditId').value = d.id;
                document.getElementById('drvBusNo').value = d.busNo;
                document.getElementById('drvName').value = d.driverName;
                document.getElementById('drvDate').value = d.date;
                document.getElementById('drvTripDue').value = d.tripDue;
                document.getElementById('drvRemaining').value = d.remaining;
                buildDriverItemsRows(d.items);
                calculateDriverNet();

                document.getElementById('drvSubmitBtn').innerText = 'حفظ تعديلات حساب السائق';
                document.getElementById('cancelEditDriverBtn').classList.remove('hidden');

                document.getElementById('driverEditAuditBox').classList.remove('hidden');
                renderAuditLogIntoBox(d.auditLog, d.createdBy, d.createdAt, 'driverEditAuditList');

                switchTab('drivers');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function resetDriverForm() {
                document.getElementById('driverForm').reset();
                document.getElementById('driverEditId').value = '';
                document.getElementById('drvDate').value = new Date().toISOString().split('T')[0];
                buildDriverItemsRows();
                document.getElementById('drvSubmitBtn').innerText = 'حفظ وتصديق حساب السائق وترحيل المصروفات للصندوق';
                document.getElementById('cancelEditDriverBtn').classList.add('hidden');
                document.getElementById('driverEditAuditBox').classList.add('hidden');
            }

            function deleteDriverAccount(idx) {
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالحذف!'); return; }
                db.drivers.splice(idx, 1);
                saveDB();
                refreshUI();
            }

            // ================= إدارة وتسجيل الباصات (رقم اللوحة، اللون، السائق الموكل من الرواتب والموظفين) =================
            function onBusColorSelectChange() {
                const sel = document.getElementById('busColorSelect');
                const inp = document.getElementById('busColor');
                if (!sel || !inp) return;
                if (sel.value === 'custom') {
                    inp.value = '';
                    inp.focus();
                } else {
                    inp.value = sel.value;
                }
            }

            function populateBusDriversDropdown() {
                const sel = document.getElementById('busDriverSelect');
                if (!sel) return;
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">-- اختر السائق الموكل (من قسم الرواتب والموظفين) --</option>';

                const allEmployees = db.employees || [];
                const driversOnly = allEmployees.filter(emp => emp.roleType === 'سائق');
                const otherEmployees = allEmployees.filter(emp => emp.roleType !== 'سائق');

                if (driversOnly.length > 0) {
                    const grpDrivers = document.createElement('optgroup');
                    grpDrivers.label = '🚌 السائقون المسجلون في الرواتب والموظفين';
                    driversOnly.forEach(drv => {
                        const opt = document.createElement('option');
                        opt.value = drv.id;
                        opt.textContent = `${drv.name} (${drv.branch || 'فرع عجمان'})`;
                        grpDrivers.appendChild(opt);
                    });
                    sel.appendChild(grpDrivers);
                }

                if (otherEmployees.length > 0) {
                    const grpOthers = document.createElement('optgroup');
                    grpOthers.label = '💼 بقية الموظفين (اختياري)';
                    otherEmployees.forEach(emp => {
                        const opt = document.createElement('option');
                        opt.value = emp.id;
                        opt.textContent = `${emp.name} - ${emp.roleType}`;
                        grpOthers.appendChild(opt);
                    });
                    sel.appendChild(grpOthers);
                }

                if (currentVal) sel.value = currentVal;
            }

            function handleSaveBus(e) {
                e.preventDefault();
                if (!db.buses) db.buses = [];
                const editId = document.getElementById('busEditId').value;
                const plateNo = document.getElementById('busPlateNo').value.trim();
                const color = document.getElementById('busColor').value.trim();
                const driverSelect = document.getElementById('busDriverSelect');
                const driverId = driverSelect.value;

                if (!plateNo || !color || !driverId) {
                    alert('يرجى إدخال رقم اللوحة واللون واختيار السائق الموكل من القائمة!');
                    return;
                }

                const empObj = (db.employees || []).find(x => String(x.id) === String(driverId));
                const driverName = empObj ? empObj.name : (driverSelect.options[driverSelect.selectedIndex]?.text || 'غير محدد');

                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();

                if (editId) {
                    const idx = db.buses.findIndex(b => String(b.id) === String(editId));
                    if (idx !== -1) {
                        let bus = db.buses[idx];
                        bus.plateNo = plateNo;
                        bus.color = color;
                        bus.driverId = driverId;
                        bus.driverName = driverName;
                        if (!bus.auditLog) bus.auditLog = [{ action: 'تسجيل الباص', user: bus.createdBy || author, time: bus.createdAt || nowStr }];
                        bus.auditLog.push({ action: `تعديل بيانات الباص (لوحة: ${plateNo} | السائق: ${driverName})`, user: author, time: nowStr });

                        // تحديث بيانات الباص تلقائياً في الرحلات المرتبطة به
                        (db.trips || []).forEach(tr => {
                            if (String(tr.busId) === String(bus.id)) {
                                tr.busInfo = `لوحة: ${plateNo} | اللون: ${color} | السائق: ${driverName}`;
                            }
                        });
                    }
                    alert('تم تحديث بيانات الباص والرحلات المرتبطة به بنجاح!');
                    resetBusForm();
                } else {
                    const newBus = {
                        id: 'bus_' + Date.now(),
                        plateNo: plateNo,
                        color: color,
                        driverId: driverId,
                        driverName: driverName,
                        branch: currentUser ? (currentUser.branch || 'فرع عجمان') : 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr,
                        auditLog: [{ action: `تسجيل باص جديد (لوحة: ${plateNo} | اللون: ${color} | السائق: ${driverName})`, user: author, time: nowStr }]
                    };
                    db.buses.unshift(newBus);
                    alert(`تم تسجيل الباص (${plateNo}) وتوكيل السائق (${driverName}) بنجاح!`);
                    resetBusForm();
                }

                saveDB();
                refreshUI();
            }

            function editBus(id) {
                const bus = (db.buses || []).find(b => String(b.id) === String(id));
                if (!bus) return;
                document.getElementById('busEditId').value = bus.id;
                document.getElementById('busPlateNo').value = bus.plateNo || '';
                document.getElementById('busColor').value = bus.color || '';

                const colorSel = document.getElementById('busColorSelect');
                const presetColors = ['أبيض', 'ذهبي', 'فضي', 'أسود', 'أزرق', 'أحمر'];
                colorSel.value = presetColors.includes(bus.color) ? bus.color : 'custom';

                populateBusDriversDropdown();
                document.getElementById('busDriverSelect').value = bus.driverId || '';

                document.getElementById('busFormTitle').innerText = `تعديل بيانات الباص (${bus.plateNo})`;
                document.getElementById('busSubmitBtn').innerHTML = '<i class="fa-solid fa-check ml-1"></i> حفظ تعديلات الباص';
                document.getElementById('cancelEditBusBtn').classList.remove('hidden');

                document.getElementById('busEditAuditBox').classList.remove('hidden');
                renderAuditLogIntoBox(bus.auditLog, bus.createdBy, bus.createdAt, 'busEditAuditList');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function resetBusForm() {
                document.getElementById('busForm').reset();
                document.getElementById('busEditId').value = '';
                document.getElementById('busColorSelect').value = 'أبيض';
                document.getElementById('busColor').value = 'أبيض';
                document.getElementById('busFormTitle').innerText = 'تسجيل باص جديد في الأسطول وتعيين السائق الموكل';
                document.getElementById('busSubmitBtn').innerHTML = '<i class="fa-solid fa-plus ml-1"></i> حفظ وتسجيل الباص';
                document.getElementById('cancelEditBusBtn').classList.add('hidden');
                document.getElementById('busEditAuditBox').classList.add('hidden');
            }

            function deleteBus(idx) {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، حذف الباص متاح للمدير العام أو محمود فقط!');
                    return;
                }
                db.buses.splice(idx, 1);
                saveDB();
                refreshUI();
            }

            function renderBusesTable() {
                const tbody = document.querySelector('#busesTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const busesList = [...(db.buses || [])];
                if (busesList.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-zinc-500 py-5">لا توجد باصات مسجلة حالياً. قم بإضافة باص جديد من النموذج أعلاه.</td></tr>`;
                    return;
                }

                busesList.forEach((bus, idx) => {
                    const realIdx = db.buses.findIndex(x => String(x.id) === String(bus.id));
                    const empObj = (db.employees || []).find(e => String(e.id) === String(bus.driverId));
                    const driverDisplayName = empObj ? empObj.name : (bus.driverName || 'غير محدد');
                    const linkedTripsCount = (db.trips || []).filter(t => String(t.busId) === String(bus.id)).length;

                    tbody.insertRow().innerHTML = `
                    <td><strong>#${busesList.length - idx}</strong></td>
                    <td><span class="bg-amber-950/70 border border-gold/40 text-gold px-2.5 py-1 rounded-lg font-black text-xs">${bus.plateNo}</span></td>
                    <td><span class="bg-zinc-800 text-zinc-200 px-2.5 py-1 rounded-lg text-xs font-bold">${bus.color}</span></td>
                    <td><strong class="text-emerald-400"><i class="fa-solid fa-id-card ml-1"></i>${driverDisplayName}</strong></td>
                    <td><span class="bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-full text-xs font-bold">${linkedTripsCount} رحلات</span></td>
                    <td><span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">${bus.branch || 'فرع عجمان'}</span></td>
                    <td class="space-x-1 space-x-reverse whitespace-nowrap">
                        <button onclick="quickLinkBusToTrip('${bus.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded text-xs font-bold" title="ربط الباص برحلة جديدة"><i class="fa-solid fa-link ml-1"></i> ربط برحلة</button>
                        <button onclick="editBus('${bus.id}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i> تعديل</button>
                        <button onclick="deleteBus(${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                });
            }

            function populateTripBusesDropdown() {
                const sel = document.getElementById('tripBusSelect');
                if (!sel) return;
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">-- اختر من الباصات المسجلة (اختياري) --</option>';

                (db.buses || []).forEach(bus => {
                    const empObj = (db.employees || []).find(e => String(e.id) === String(bus.driverId));
                    const driverName = empObj ? empObj.name : (bus.driverName || 'غير محدد');
                    const opt = document.createElement('option');
                    opt.value = bus.id;
                    opt.textContent = `لوحة: ${bus.plateNo} | اللون: ${bus.color} | السائق: ${driverName}`;
                    sel.appendChild(opt);
                });

                if (currentVal) sel.value = currentVal;
            }

            function onBusSelectedForTrip() {
                const busId = document.getElementById('tripBusSelect').value;
                const busInfoInp = document.getElementById('tripBusInfo');
                if (!busId || !busInfoInp) return;

                const bus = (db.buses || []).find(b => String(b.id) === String(busId));
                if (bus) {
                    const empObj = (db.employees || []).find(e => String(e.id) === String(bus.driverId));
                    const driverName = empObj ? empObj.name : (bus.driverName || 'غير محدد');
                    busInfoInp.value = `لوحة: ${bus.plateNo} | اللون: ${bus.color} | السائق: ${driverName}`;
                }
            }

            function quickLinkBusToTrip(busId) {
                switchTab('trips');
                resetTripForm();
                populateTripBusesDropdown();
                const sel = document.getElementById('tripBusSelect');
                if (sel) {
                    sel.value = busId;
                    onBusSelectedForTrip();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // ================= إدارة الرحلات (مقيدة لمحمود والمدير العام فقط) =================
            function handleSaveTrip(e) {
                e.preventDefault();
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، إنشاء أو تعديل الرحلة وتغيير حالتها متاح فقط للمستخدم محمود وللمدير العام!');
                    return;
                }
                const editId = document.getElementById('tripEditId').value;
                const tripDate = document.getElementById('tripDate').value;
                const tripRoute = document.getElementById('tripRoute').value;
                const tripBusId = document.getElementById('tripBusSelect') ? document.getElementById('tripBusSelect').value : '';
                const tripBusInfo = document.getElementById('tripBusInfo').value;
                const tripStatus = document.getElementById('tripStatus').value;

                if (editId) {
                    const idx = db.trips.findIndex(t => t.id === editId);
                    if (idx !== -1) {
                        db.trips[idx].date = tripDate || '-';
                        db.trips[idx].route = tripRoute;
                        db.trips[idx].busId = tripBusId || '';
                        db.trips[idx].busInfo = tripBusInfo;
                        db.trips[idx].status = tripStatus;
                        alert('تم تعديل بيانات الرحلة بنجاح!');
                    }
                } else {
                    const newTrip = {
                        id: 'trip_' + Date.now(),
                        date: tripDate || '-',
                        route: tripRoute,
                        busId: tripBusId || '',
                        busInfo: tripBusInfo,
                        status: tripStatus || 'مجدولة',
                        branch: currentUser.branch || 'فرع عجمان',
                        createdBy: getCurrentUserName()
                    };
                    db.trips.unshift(newTrip);
                    alert('تم إنشاء الرحلة وربط الباص بنجاح!');
                }
                saveDB();
                resetTripForm();
                refreshUI();
            }

            function editTrip(id) {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، تعديل الرحلة وتغيير حالتها متاح فقط للمستخدم محمود وللمدير العام!');
                    return;
                }
                const trip = db.trips.find(t => t.id === id);
                if (!trip) return;
                document.getElementById('tripEditId').value = trip.id;
                document.getElementById('tripDate').value = trip.date !== '-' ? trip.date : '';
                document.getElementById('tripRoute').value = trip.route;
                populateTripBusesDropdown();
                if (document.getElementById('tripBusSelect')) {
                    document.getElementById('tripBusSelect').value = trip.busId || '';
                }
                document.getElementById('tripBusInfo').value = trip.busInfo;
                document.getElementById('tripStatus').value = trip.status || 'مجدولة';

                document.getElementById('tripFormTitle').innerText = 'تعديل بيانات الرحلة';
                document.getElementById('tripSubmitBtn').innerText = 'حفظ تعديلات الرحلة';
                document.getElementById('cancelEditTripBtn').classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function markTripDeparted(id) {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، تغيير حالة الرحلة متاح فقط للمستخدم محمود وللمدير العام!');
                    return;
                }
                const idx = db.trips.findIndex(t => t.id === id);
                if (idx !== -1) {
                    db.trips[idx].status = 'غادرت الرحلة';
                    saveDB();
                    refreshUI();
                    alert('تم تحديث حالة الرحلة إلى: غادرت الرحلة وتم نقل عرض تذاكرها وفواتيرها إلى قسم الإدارة المالية.');
                }
            }

            function resetTripForm() {
                document.getElementById('tripForm').reset();
                document.getElementById('tripEditId').value = '';
                if (document.getElementById('tripBusSelect')) document.getElementById('tripBusSelect').value = '';
                document.getElementById('tripFormTitle').innerText = 'إنشاء / تعديل رحلة';
                document.getElementById('tripSubmitBtn').innerText = 'إنشاء الرحلة';
                document.getElementById('cancelEditTripBtn').classList.add('hidden');
            }

            function renderTripsTable() {
                const tbody = document.querySelector('#tripsTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                let tripsList = [...db.trips];
                tripsList.sort((a, b) => b.id.localeCompare(a.id));
                const allowTripModify = isMahmoudOrGeneralManager();
                const isFinOrAdmin = canModifyFinancialsOrAccounts();

                tripsList.forEach((trip, idx) => {
                    const realIdx = db.trips.findIndex(x => x.id === trip.id);
                    const linkedTickets = db.passengers.filter(p => p.tripId === trip.id).length;
                    let statusBadge = '<span class="bg-amber-950 text-amber-300 px-2 py-1 rounded text-xs font-bold">مجدولة</span>';
                    if (trip.status === 'غادرت الرحلة') {
                        statusBadge = '<span class="bg-indigo-900 text-indigo-200 px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-plane-departure ml-1"></i>غادرت الرحلة</span>';
                    } else if (trip.status === 'مكتملة') {
                        statusBadge = '<span class="bg-emerald-950 text-emerald-300 px-2 py-1 rounded text-xs font-bold">مكتملة</span>';
                    } else if (trip.status === 'ملغاة') {
                        statusBadge = '<span class="bg-red-950 text-red-300 px-2 py-1 rounded text-xs font-bold">ملغاة</span>';
                    }

                    // الرحلات التي غادرت: تُخفى تذاكرها وفواتيرها من هذا الجدول وتظهر في قسم الإدارة المالية للمدير العام والمحاسب ومحمود فقط
                    const isDeparted = trip.status === 'غادرت الرحلة';
                    let viewBtnHtml = '';
                    if (!isDeparted) {
                        viewBtnHtml = `<button onclick="openTripDetailsModal('${trip.id}', 'ops')" class="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded text-xs font-bold"><i class="fa-solid fa-eye ml-1"></i> عرض الرحلة</button>`;
                    } else if (isFinOrAdmin) {
                        viewBtnHtml = `<button onclick="switchTab('financials'); openTripDetailsModal('${trip.id}', 'finance');" class="bg-indigo-700 hover:bg-indigo-600 text-white px-2.5 py-1 rounded text-xs font-bold" title="عرض في الإدارة المالية"><i class="fa-solid fa-calculator ml-1"></i> في الإدارة المالية</button>`;
                    } else {
                        viewBtnHtml = `<span class="text-[11px] text-zinc-500 px-2"><i class="fa-solid fa-lock ml-1"></i> مغادرة (الإدارة المالية)</span>`;
                    }

                    tbody.insertRow().innerHTML = `
                    <td><strong>#${tripsList.length - idx}</strong></td>
                    <td><strong class="text-gold">${trip.date}</strong></td>
                    <td>${trip.route}</td>
                    <td>${trip.busInfo}</td>
                    <td>${statusBadge}</td>
                    <td><span class="bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded-full text-xs font-bold">${linkedTickets} تذاكر</span></td>
                    <td class="space-x-1 space-x-reverse whitespace-nowrap">
                        ${viewBtnHtml}
                        ${allowTripModify && trip.status !== 'غادرت الرحلة' ? `<button onclick="markTripDeparted('${trip.id}')" class="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-indigo-500"><i class="fa-solid fa-bus"></i> غادرت الرحلة</button>` : ''}
                        ${allowTripModify ? `<button onclick="editTrip('${trip.id}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i> تعديل</button>` : ''}
                        <button onclick="openManifestForTrip('${trip.date}')" class="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-lines"></i> مانفيستو</button>
                        ${allowTripModify ? `<button onclick="deleteTrip(${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                `;
                });
            }

            function populateTripsDropdown() {
                const passSel = document.getElementById('passTripSelect');
                const cargoSel = document.getElementById('cargoTripSelect');

                const currentPassVal = passSel ? passSel.value : '';
                const currentCargoVal = cargoSel ? cargoSel.value : '';

                if (passSel) passSel.innerHTML = '<option value="">-- اختر الرحلة أولاً --</option>';
                if (cargoSel) cargoSel.innerHTML = '<option value="">-- اختر الرحلة المرتبطة (اختياري) --</option>';

                let tripsList = [...db.trips];
                tripsList.sort((a, b) => b.id.localeCompare(a.id));

                const passEditId = document.getElementById('passEditId') ? document.getElementById('passEditId').value : '';
                const cargoEditId = document.getElementById('cargoEditId') ? document.getElementById('cargoEditId').value : '';
                const editingPassItem = passEditId ? db.passengers.find(x => String(x.id) === String(passEditId)) : null;
                const editingCargoItem = cargoEditId ? db.cargo.find(x => String(x.id) === String(cargoEditId)) : null;

                tripsList.forEach(trip => {
                    const isDeparted = trip.status === 'غادرت الرحلة';
                    const text = isDeparted
                        ? `${trip.date !== '-' ? trip.date : 'بدون تاريخ'} (${trip.route}) - ${trip.busInfo} [غادرت الرحلة - الإضافة عبر الإدارة المالية فقط]`
                        : `${trip.date !== '-' ? trip.date : 'بدون تاريخ'} (${trip.route}) - ${trip.busInfo} [${trip.status || 'مجدولة'}]`;

                    const allowDepartedInSelect = (financeOverrideDepartedTripId && String(financeOverrideDepartedTripId) === String(trip.id)) ||
                        (editingPassItem && String(editingPassItem.tripId) === String(trip.id)) ||
                        (editingCargoItem && String(editingCargoItem.tripId) === String(trip.id));

                    if (passSel) {
                        const opt = document.createElement('option');
                        opt.value = trip.id;
                        opt.textContent = text;
                        if (isDeparted && !allowDepartedInSelect) {
                            opt.disabled = true;
                        }
                        passSel.appendChild(opt);
                    }

                    if (cargoSel) {
                        const opt = document.createElement('option');
                        opt.value = trip.id;
                        opt.textContent = text;
                        if (isDeparted && !allowDepartedInSelect) {
                            opt.disabled = true;
                        }
                        cargoSel.appendChild(opt);
                    }
                });

                if (passSel && currentPassVal) passSel.value = currentPassVal;
                if (cargoSel && currentCargoVal) cargoSel.value = currentCargoVal;
            }

            function onTripSelectedForTicket() {
                const tripId = document.getElementById('passTripSelect').value;
                const trip = db.trips.find(t => t.id === tripId);
                if (trip && trip.date && trip.date !== '-') {
                    document.getElementById('passDate').value = trip.date;
                    updateReportingTimeAutomatically();
                }
            }

            function onTripSelectedForCargo() {
                const tripId = document.getElementById('cargoTripSelect').value;
                const trip = db.trips.find(t => t.id === tripId);
                if (trip && trip.date && trip.date !== '-') {
                    document.getElementById('cargoDate').value = trip.date;
                }
            }

            function openManifestForTrip(tripDate) {
                document.getElementById('manifestFilterDate').value = tripDate !== '-' ? tripDate : new Date().toISOString().split('T')[0];
                renderPassengerManifestTable();
                document.getElementById('manifestModal').classList.remove('hidden');
            }

            function deleteTrip(idx) {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، حذف الرحلة متاح فقط للمستخدم محمود وللمدير العام!');
                    return;
                }
                db.trips.splice(idx, 1);
                saveDB();
                renderTripsTable();
                populateTripsDropdown();
            }

            // ================= دوال الطباعة وتصدير PDF وحفظ الصور (تنسيق A5 للفواتير والتذاكر / A4 أفقي للكشوفات والمانفيستو) =================
            const A5_DOCUMENT_IDS = ['ticketCaptureArea', 'cargoCaptureArea', 'debtInvCaptureArea'];

            function printDocumentA5() {
                const styleEl = document.getElementById('dynamicPrintPageStyle');
                if (styleEl) styleEl.innerHTML = '@page { size: A5 portrait; margin: 6mm; }';
                setTimeout(() => { window.print(); }, 100);
            }

            function printDocumentLandscape() {
                const styleEl = document.getElementById('dynamicPrintPageStyle');
                if (styleEl) styleEl.innerHTML = '@page { size: A4 landscape; margin: 8mm; }';
                setTimeout(() => { window.print(); }, 100);
            }

            function downloadCapturedImage(elementId, fileName) {
                const el = document.getElementById(elementId);
                if (!el) return;
                const isA5 = A5_DOCUMENT_IDS.includes(elementId);
                const prevMaxW = el.style.maxWidth;
                const prevW = el.style.width;
                if (isA5) {
                    el.style.width = '148mm';
                    el.style.maxWidth = '148mm';
                }
                el.classList.add('capturing-hide-executor');
                html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                    el.classList.remove('capturing-hide-executor');
                    if (isA5) {
                        el.style.width = prevW;
                        el.style.maxWidth = prevMaxW;
                    }
                    const link = document.createElement('a');
                    link.download = `${fileName}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                });
            }

            function exportToPDF(elementId, fileName) {
                const el = document.getElementById(elementId);
                if (!el) return;
                const isA5 = A5_DOCUMENT_IDS.includes(elementId);
                const prevMaxW = el.style.maxWidth;
                const prevW = el.style.width;
                if (isA5) {
                    el.style.width = '148mm';
                    el.style.maxWidth = '148mm';
                }
                el.classList.add('capturing-hide-executor');
                html2canvas(el, { scale: 2.5, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                    el.classList.remove('capturing-hide-executor');
                    if (isA5) {
                        el.style.width = prevW;
                        el.style.maxWidth = prevMaxW;
                    }
                    const imgData = canvas.toDataURL('image/jpeg', 0.96);
                    if (isA5) {
                        const pdf = new jsPDF('p', 'mm', 'a5');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();
                        const margin = 5;
                        const usableW = pdfWidth - margin * 2;
                        let finalW = usableW;
                        let finalH = (canvas.height * finalW) / canvas.width;
                        if (finalH > pdfHeight - margin * 2) {
                            finalH = pdfHeight - margin * 2;
                            finalW = (canvas.width * finalH) / canvas.height;
                        }
                        const xOffset = (pdfWidth - finalW) / 2;
                        pdf.addImage(imgData, 'JPEG', xOffset, margin, finalW, finalH);
                        pdf.save(`${fileName}.pdf`);
                    } else {
                        const pdf = new jsPDF('l', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();
                        const margin = 8;
                        const usableW = pdfWidth - margin * 2;
                        let finalW = usableW;
                        let finalH = (canvas.height * finalW) / canvas.width;
                        if (finalH > pdfHeight - margin * 2) {
                            finalH = pdfHeight - margin * 2;
                            finalW = (canvas.width * finalH) / canvas.height;
                        }
                        const xOffset = (pdfWidth - finalW) / 2;
                        pdf.addImage(imgData, 'JPEG', xOffset, margin, finalW, finalH);
                        pdf.save(`${fileName}.pdf`);
                    }
                });
            }

            function exportMultiPagePDF(elementId, fileNamePrefix) {
                const el = document.getElementById(elementId);
                if (!el) return;
                el.classList.add('capturing-hide-executor');
                html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                    el.classList.remove('capturing-hide-executor');
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const pdf = new jsPDF('l', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    const margin = 8;
                    const imgWidth = pdfWidth - margin * 2;
                    const pageHeight = pdfHeight - margin * 2;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    let heightLeft = imgHeight;
                    let position = margin;

                    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;

                    while (heightLeft > 0) {
                        position = margin - (imgHeight - heightLeft);
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }
                    pdf.save(`${fileNamePrefix}${Date.now()}.pdf`);
                });
            }

            // ================= التذاكر والركاب =================
            function updateReportingTimeAutomatically() {
                const origin = document.getElementById('passOrigin').value;
                const dateStr = document.getElementById('passDate').value;
                const timeInput = document.getElementById('passReportingTime');
                if (!timeInput) return;

                let isWednesday = false;
                if (dateStr) {
                    const parts = dateStr.split('-');
                    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
                    if (dt.getDay() === 3) { isWednesday = true; }
                }

                if (origin === 'عجمان') {
                    timeInput.value = '4:00 عصراً';
                } else if (origin === 'بني ياس') {
                    timeInput.value = isWednesday ? '6:00 مساءً' : '5:30 مساءً';
                } else if (origin === 'العين') {
                    timeInput.value = '7:00 مساءً';
                } else if (origin === 'عبري') {
                    timeInput.value = '9:00 مساءً';
                } else if (origin === 'شحن') {
                    timeInput.value = '7:00 صباحاً';
                } else if (origin === 'المكلا') {
                    timeInput.value = '1:30 ظهراً';
                } else if (origin === 'القيضة') {
                    timeInput.value = '4:00 عصراً';
                } else if (origin === 'عدن') {
                    timeInput.value = '6:00 صباحاً';
                }
            }

            function onPassengerCountChanged() {
                const count = parseInt(document.getElementById('passCount').value);
                const container = document.getElementById('extraPassengersContainer');
                const rowsDiv = document.getElementById('extraPassengersRows');
                rowsDiv.innerHTML = '';
                const baseTicketNum = parseInt(document.getElementById('passTicketNo').value) || db.nextTicketNo || 115;

                if (count > 1) {
                    container.classList.remove('hidden');
                    for (let i = 1; i < count; i++) {
                        const autoSubTicketNo = baseTicketNum + i;
                        rowsDiv.innerHTML += `
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-zinc-900 p-2 rounded border border-zinc-800 items-center">
                            <div class="flex items-center gap-1.5">
                                <span class="bg-amber-950 text-gold border border-gold/40 px-2 py-1 rounded text-[11px] font-black shrink-0">#${autoSubTicketNo}</span>
                                <input type="hidden" class="extra-ticket-no" value="${autoSubTicketNo}">
                                <input type="text" placeholder="اسم المرافق ${i}" class="extra-name w-full bg-darkbg border border-zinc-700 rounded p-2 text-xs text-zinc-200" required>
                            </div>
                            <input type="text" placeholder="جواز / هوية المرافق ${i}" class="extra-passport bg-darkbg border border-zinc-700 rounded p-2 text-xs text-zinc-200" required>
                            <input type="tel" placeholder="هاتف المرافق ${i} (اختياري)" class="extra-phone bg-darkbg border border-zinc-700 rounded p-2 text-xs text-zinc-200">
                        </div>
                    `;
                    }
                } else { container.classList.add('hidden'); }
            }

            function handleSavePassenger(e) {
                e.preventDefault();
                const editId = document.getElementById('passEditId').value;
                const tktId = document.getElementById('passTicketNo').value.trim();
                const tripId = document.getElementById('passTripSelect').value;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();

                if (!tripId) {
                    alert('يرجى اختيار الرحلة المجدولة أولاً قبل إصدار التذكرة!');
                    return;
                }

                const selectedTrip = (db.trips || []).find(t => String(t.id) === String(tripId));
                if (selectedTrip && selectedTrip.status === 'غادرت الرحلة') {
                    const canFinanceOverride = canModifyFinancialsOrAccounts() && (
                        String(financeOverrideDepartedTripId) === String(tripId) ||
                        (editId && db.passengers.some(x => String(x.id) === String(editId) && String(x.tripId) === String(tripId)))
                    );
                    if (!canFinanceOverride) {
                        alert('عذراً، هذه الرحلة غادرت! لا يمكن إضافة أو تعديل تذكرة لها إلا عبر الإدارة المالية من جدول (الرحلات التي غادرت).');
                        return;
                    }
                }

                const count = parseInt(document.getElementById('passCount').value);
                let extraList = [];
                if (count > 1) {
                    const nameEls = document.querySelectorAll('.extra-name');
                    const passEls = document.querySelectorAll('.extra-passport');
                    const phoneEls = document.querySelectorAll('.extra-phone');
                    const ticketEls = document.querySelectorAll('.extra-ticket-no');
                    const baseNum = parseInt(tktId) || db.nextTicketNo || 115;
                    nameEls.forEach((el, idx) => {
                        const assignedTicketNo = (ticketEls[idx] && ticketEls[idx].value.trim()) ? ticketEls[idx].value.trim() : String(baseNum + idx + 1);
                        extraList.push({
                            ticketNo: assignedTicketNo,
                            name: el.value,
                            passport: passEls[idx] ? passEls[idx].value : '',
                            phone: phoneEls[idx] ? phoneEls[idx].value : ''
                        });
                    });
                }

                const orig = document.getElementById('passOrigin').value;
                const dest = document.getElementById('passDestination').value;
                const fare = parseFloat(document.getElementById('passManualTotal').value) || 0;
                const dateStr = document.getElementById('passDate').value;
                const repTime = document.getElementById('passReportingTime').value;
                const agent = document.getElementById('passAgent').value;
                const name = document.getElementById('passName').value;
                const phone = document.getElementById('passPhone').value;
                const passport = document.getElementById('passPassport').value;
                const payMethod = document.getElementById('passPayMethod').value;
                const notes = document.getElementById('passNotes').value.trim();

                if (editId) {
                    const idx = db.passengers.findIndex(p => String(p.id) === String(editId));
                    if (idx !== -1) {
                        let oldObj = db.passengers[idx];
                        if (payMethod !== oldObj.payMethod && !canModifyFinancialsOrAccounts()) {
                            alert('عذراً، تغيير حالة السداد مسموح فقط لمحمود، المدير العام، أو المحاسب!');
                            return;
                        }
                        oldObj.id = tktId;
                        oldObj.tripId = tripId;
                        oldObj.agent = agent;
                        oldObj.name = name;
                        oldObj.phone = phone;
                        oldObj.passport = passport;
                        oldObj.passengerCount = count;
                        oldObj.extraPassengers = extraList;
                        oldObj.origin = orig;
                        oldObj.destination = dest;
                        oldObj.date = dateStr;
                        oldObj.reportingTime = repTime;
                        oldObj.fare = fare;
                        oldObj.payMethod = payMethod;
                        oldObj.notes = notes;
                        if (!oldObj.auditLog) oldObj.auditLog = [{ action: 'إنشاء التذكرة', user: oldObj.createdBy || author, time: oldObj.createdAt || nowStr }];
                        oldObj.auditLog.push({ action: 'تعديل التذكرة', user: author, time: nowStr });
                    }
                    financeOverrideDepartedTripId = null;
                    saveDB();
                    resetPassengerForm();
                    refreshUI();
                    previewTicketImage(tktId);
                    setTimeout(() => { downloadCapturedImage('ticketCaptureArea', getTicketFileName()); }, 600);
                } else {
                    const newPassenger = {
                        id: tktId,
                        tripId: tripId,
                        agent: agent,
                        name: name,
                        phone: phone,
                        passport: passport,
                        passengerCount: count,
                        extraPassengers: extraList,
                        origin: orig,
                        destination: dest,
                        date: dateStr,
                        reportingTime: repTime,
                        fare: fare,
                        payMethod: payMethod,
                        notes: notes,
                        branch: currentUser.branch || 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr,
                        auditLog: [{ action: 'إنشاء التذكرة', user: author, time: nowStr }]
                    };
                    db.passengers.unshift(newPassenger);
                    financeOverrideDepartedTripId = null;
                    saveDB();
                    resetPassengerForm();
                    refreshUI();
                    previewTicketImage(tktId);
                    setTimeout(() => { downloadCapturedImage('ticketCaptureArea', getTicketFileName()); }, 600);
                }
            }

            function editPassenger(id) {
                const p = db.passengers.find(x => String(x.id) === String(id));
                if (!p) return;

                if (p.tripId) {
                    const trip = (db.trips || []).find(t => String(t.id) === String(p.tripId));
                    if (trip && trip.status === 'غادرت الرحلة' && !canModifyFinancialsOrAccounts()) {
                        alert('عذراً، هذه التذكرة تابعة لرحلة مغادرة! لا يمكن تعديلها إلا من خلال الإدارة المالية.');
                        return;
                    }
                }

                document.getElementById('passEditId').value = p.id;
                document.getElementById('passTicketNo').value = p.id;
                populateTripsDropdown();
                document.getElementById('passTripSelect').value = p.tripId || '';
                document.getElementById('passAgent').value = p.agent || 'أبو خالد';
                document.getElementById('passDate').value = p.date;
                document.getElementById('passManualTotal').value = p.fare;
                document.getElementById('passCount').value = p.passengerCount;
                onPassengerCountChanged();

                if (p.extraPassengers && p.extraPassengers.length > 0) {
                    const nameEls = document.querySelectorAll('.extra-name');
                    const passEls = document.querySelectorAll('.extra-passport');
                    const phoneEls = document.querySelectorAll('.extra-phone');
                    const ticketEls = document.querySelectorAll('.extra-ticket-no');
                    p.extraPassengers.forEach((ex, i) => {
                        if (nameEls[i]) nameEls[i].value = ex.name;
                        if (passEls[i]) passEls[i].value = ex.passport;
                        if (phoneEls[i]) phoneEls[i].value = ex.phone || '';
                        if (ticketEls[i] && ex.ticketNo) {
                            ticketEls[i].value = ex.ticketNo;
                            const badgeEl = ticketEls[i].parentElement?.querySelector('span');
                            if (badgeEl) badgeEl.innerText = `#${ex.ticketNo}`;
                        }
                    });
                }

                document.getElementById('passName').value = p.name;
                document.getElementById('passPhone').value = p.phone;
                document.getElementById('passPassport').value = p.passport;
                document.getElementById('passOrigin').value = p.origin;
                document.getElementById('passDestination').value = p.destination;
                document.getElementById('passPayMethod').value = p.payMethod;
                document.getElementById('passReportingTime').value = p.reportingTime;
                document.getElementById('passNotes').value = p.notes || '';

                document.getElementById('passFormTitle').innerText = `تعديل التذكرة #${p.id}`;
                document.getElementById('passSubmitBtn').innerText = 'حفظ تعديلات التذكرة';
                document.getElementById('cancelEditPassBtn').classList.remove('hidden');

                document.getElementById('passEditAuditBox').classList.remove('hidden');
                renderAuditLogIntoBox(p.auditLog, p.createdBy, p.createdAt, 'passEditAuditList');

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function resetPassengerForm() {
                document.getElementById('passengerForm').reset();
                document.getElementById('passEditId').value = '';
                document.getElementById('passDate').value = new Date().toISOString().split('T')[0];
                document.getElementById('passManualTotal').value = 350;
                document.getElementById('passNotes').value = '';
                updateReportingTimeAutomatically();
                document.getElementById('extraPassengersContainer').classList.add('hidden');
                document.getElementById('passFormTitle').innerText = 'إصدار تذكرة سفر جديدة';
                document.getElementById('passSubmitBtn').innerText = 'حفظ وإصدار التذكرة وتنزيل الصورة';
                document.getElementById('cancelEditPassBtn').classList.add('hidden');
                document.getElementById('passEditAuditBox').classList.add('hidden');
                calculateNextSequenceNumbers();
            }

            function previewTicketImage(id) {
                const tkt = db.passengers.find(x => String(x.id) === String(id));
                if (!tkt) return;
                currentPreviewTicket = tkt;
                document.getElementById('imgTicketCode').innerText = `#${tkt.id}`;
                document.getElementById('imgTktName').innerText = tkt.name;
                document.getElementById('imgTktPhone').innerText = tkt.phone;
                document.getElementById('imgTktPassport').innerText = tkt.passport;
                document.getElementById('imgTktRoute').innerText = `${tkt.origin} ➔ ${tkt.destination}`;
                document.getElementById('imgTktDate').innerText = tkt.date;
                document.getElementById('imgTktTime').innerText = tkt.reportingTime || '4:00 عصراً';
                document.getElementById('imgTktFare').innerText = `${tkt.fare} AED`;
                document.getElementById('imgTktPayStatus').innerText = tkt.payMethod || 'مدفوع';

                try {
                    if (typeof JsBarcode !== 'undefined') {
                        JsBarcode("#ticketBarcode", `WB-${tkt.id}`, {
                            format: "CODE128",
                            lineColor: "#0f172a",
                            width: 1.5,
                            height: 28,
                            displayValue: false,
                            margin: 0
                        });
                    }
                } catch (e) { console.warn("Barcode error:", e); }

                const extraBox = document.getElementById('imgTicketExtraBox');
                if (tkt.extraPassengers && tkt.extraPassengers.length > 0) {
                    let html = '<div class="bg-amber-50 p-2 rounded-lg border border-amber-200 text-xs mb-3"><strong class="text-amber-800 block mb-1">المرافقون وتذاكرهم المستقلة:</strong><ul class="list-disc pr-4 space-y-0.5 text-slate-700">';
                    tkt.extraPassengers.forEach((ex, i) => {
                        const subTktBadge = ex.ticketNo ? `<span class="font-black text-indigo-700">[تذكرة #${ex.ticketNo}]</span> ` : '';
                        html += `<li>${subTktBadge}${ex.name} (جواز: ${ex.passport})${ex.phone ? ` - هاتف: ${ex.phone}` : ''}</li>`;
                    });
                    html += '</ul></div>';
                    extraBox.innerHTML = html;
                } else { extraBox.innerHTML = ''; }

                const notesBox = document.getElementById('imgTicketNotesBox');
                if (tkt.notes && tkt.notes.trim() !== '') {
                    document.getElementById('imgTktNotes').innerText = tkt.notes;
                    notesBox.classList.remove('hidden');
                } else {
                    notesBox.classList.add('hidden');
                }

                document.getElementById('ticketPreviewModal').classList.remove('hidden');
            }

            function openManifestModal() {
                document.getElementById('manifestFilterDate').value = new Date().toISOString().split('T')[0];
                renderPassengerManifestTable();
                document.getElementById('manifestModal').classList.remove('hidden');
            }

            function renderPassengerManifestTable() {
                const targetDate = document.getElementById('manifestFilterDate').value;
                document.getElementById('manifestActiveDateBadge').innerText = targetDate || 'جميع التواريخ';
                document.getElementById('manifestIssueDate').innerText = new Date().toLocaleDateString('ar-AE');

                let list = getFilteredData(db.passengers);
                if (targetDate) { list = list.filter(p => p.date === targetDate); }

                let totalPax = 0;
                const tbody = document.getElementById('manifestTableBody');
                tbody.innerHTML = '';
                let rowCounter = 1;

                list.forEach((p) => {
                    totalPax += (p.passengerCount || 1);

                    // صف الراكب الرئيسي
                    tbody.insertRow().innerHTML = `
                    <td class="border border-slate-300 p-2 font-bold">${rowCounter++}</td>
                    <td class="border border-slate-300 p-2 font-bold text-indigo-800">#${p.id}</td>
                    <td class="border border-slate-300 p-2 font-bold">${p.name}</td>
                    <td class="border border-slate-300 p-2 text-xs font-bold text-emerald-700">راكب رئيسي</td>
                    <td class="border border-slate-300 p-2">${p.phone}</td>
                    <td class="border border-slate-300 p-2 font-mono text-xs">${p.passport}</td>
                    <td class="border border-slate-300 p-2">${p.origin} ➔ ${p.destination}</td>
                    <td class="border border-slate-300 p-2 font-bold man-price-col">${p.fare} AED</td>
                    <td class="border border-slate-300 p-2 font-bold">${p.payMethod}</td>
                `;

                    // صفوف مستقلة للركاب الإضافيين في المانفيستو برقم تذكرة مستقل
                    if (p.extraPassengers && p.extraPassengers.length > 0) {
                        p.extraPassengers.forEach((ex, i) => {
                            const subTicketId = ex.ticketNo || `${p.id}-${i + 1}`;
                            tbody.insertRow().innerHTML = `
                            <td class="border border-slate-300 p-2 font-bold bg-slate-50">${rowCounter++}</td>
                            <td class="border border-slate-300 p-2 font-bold text-amber-700 bg-slate-50">#${subTicketId}</td>
                            <td class="border border-slate-300 p-2 font-bold bg-slate-50">${ex.name}</td>
                            <td class="border border-slate-300 p-2 text-xs font-bold text-amber-800 bg-slate-50">مرافق (${i + 1})</td>
                            <td class="border border-slate-300 p-2 text-xs bg-slate-50">${ex.phone || p.phone} <span class="text-slate-500">(تابع لـ: ${p.name})</span></td>
                            <td class="border border-slate-300 p-2 font-mono text-xs bg-slate-50">${ex.passport}</td>
                            <td class="border border-slate-300 p-2 bg-slate-50">${p.origin} ➔ ${p.destination}</td>
                            <td class="border border-slate-300 p-2 text-xs text-slate-500 man-price-col bg-slate-50">مشمول بتذكرة #${p.id}</td>
                            <td class="border border-slate-300 p-2 font-bold bg-slate-50">${p.payMethod}</td>
                        `;
                        });
                    }
                });

                document.getElementById('manifestTotalBookings').innerText = list.length;
                document.getElementById('manifestTotalPassengers').innerText = totalPax;
            }

            function printManifestPassenger(mode) {
                const sub = document.getElementById('manifestTypeSubtitle');
                const priceCols = document.querySelectorAll('.man-price-col');
                if (mode === 'driver') {
                    sub.innerText = 'كشف ركاب الرحلة الرسمي - نسخة السائق (بدون أسعار)';
                    priceCols.forEach(c => c.style.display = 'none');
                } else {
                    sub.innerText = 'كشف ركاب الرحلة الرسمي - نسخة الإدارة (بالأسعار)';
                    priceCols.forEach(c => c.style.display = '');
                }
                printDocumentLandscape();
            }

            // ================= الشحن والأصناف =================
            function compressImageFile(file, maxWidth = 900, quality = 0.72) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الصورة'));
                    reader.onload = event => {
                        const image = new Image();
                        image.onerror = () => reject(new Error('ملف الصورة غير صالح'));
                        image.onload = () => {
                            if (!image.naturalWidth || !image.naturalHeight) {
                                reject(new Error('أبعاد الصورة غير صالحة'));
                                return;
                            }
                            const scale = Math.min(1, maxWidth / image.naturalWidth);
                            const canvas = document.createElement('canvas');
                            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                            const context = canvas.getContext('2d');
                            if (!context) {
                                reject(new Error('تعذر تجهيز الصورة للضغط'));
                                return;
                            }
                            context.drawImage(image, 0, 0, canvas.width, canvas.height);
                            try {
                                resolve(canvas.toDataURL('image/jpeg', quality));
                            } catch (error) {
                                reject(error);
                            }
                        };
                        if (typeof event.target.result !== 'string') {
                            reject(new Error('تعذر تحميل بيانات الصورة'));
                            return;
                        }
                        image.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            }

            async function handleCargoImagesSelect(event) {
                const input = event.target;
                const files = Array.from(input.files || []);
                if (!files.length) return;
                const failures = [];

                for (const file of files) {
                    if (!file.type.startsWith('image/')) {
                        failures.push(file.name);
                        continue;
                    }
                    try {
                        currentCargoAttachments.push(await compressImageFile(file));
                    } catch (error) {
                        console.error('Cargo image processing failed:', file.name, error);
                        failures.push(file.name);
                    }
                }

                input.value = '';
                renderCargoFormImagesPreview();
                if (failures.length) {
                    alert(`تعذر معالجة الصور التالية: ${failures.join('، ')}`);
                }
            }

            function removeCargoAttachment(index) {
                if (!Number.isInteger(index) || index < 0 || index >= currentCargoAttachments.length) return;
                currentCargoAttachments.splice(index, 1);
                renderCargoFormImagesPreview();
            }

            function renderCargoFormImagesPreview() {
                const grid = document.getElementById('cargoImagesPreviewGrid');
                if (!grid) return;
                grid.replaceChildren();
                if (!currentCargoAttachments.length) {
                    grid.classList.add('hidden');
                    return;
                }

                grid.classList.remove('hidden');
                currentCargoAttachments.forEach((source, index) => {
                    const item = document.createElement('div');
                    item.className = 'relative group rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 aspect-square';
                    const image = document.createElement('img');
                    image.src = source;
                    image.alt = `صورة مرفقة ${index + 1}`;
                    image.className = 'w-full h-full object-cover';
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.title = 'حذف الصورة';
                    remove.className = 'absolute top-1 left-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shadow';
                    remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                    remove.addEventListener('click', () => removeCargoAttachment(index));
                    item.append(image, remove);
                    grid.appendChild(item);
                });
            }

            function viewCargoPhotos(id) {
                const cargo = db.cargo.find(item => String(item.id) === String(id));
                const photos = cargo && Array.isArray(cargo.photos)
                    ? cargo.photos.filter(source => typeof source === 'string' && source.startsWith('data:image/'))
                    : [];
                if (!cargo || !photos.length) {
                    alert('لا توجد صور صالحة مرفقة لهذه الفاتورة.');
                    return;
                }

                document.getElementById('cargoPhotosModalCode').innerText = `#${cargo.id}`;
                const grid = document.getElementById('cargoPhotosModalGrid');
                grid.replaceChildren();
                photos.forEach((source, index) => {
                    const link = document.createElement('a');
                    link.href = source;
                    link.download = `cargo_${String(cargo.id).replace(/[^a-zA-Z0-9_-]/g, '_')}_photo_${index + 1}.jpg`;
                    link.title = 'انقر لتحميل الصورة';
                    link.className = 'block rounded-xl overflow-hidden border border-gold/40 bg-zinc-900 aspect-square hover:border-gold transition';
                    const image = document.createElement('img');
                    image.src = source;
                    image.alt = `صورة الشحنة ${index + 1}`;
                    image.className = 'w-full h-full object-cover';
                    link.appendChild(image);
                    grid.appendChild(link);
                });
                document.getElementById('cargoPhotosModal').classList.remove('hidden');
            }

            function addCargoItemRow(descVal = '', qtyVal = 1, priceVal = '') {
                const tbody = document.getElementById('cargoItemsRowsContainer');
                const tr = document.createElement('tr');
                tr.className = "border-b border-zinc-800/60";
                tr.innerHTML = `
                <td class="p-1.5"><input type="text" value="${descVal}" placeholder="وصف الصنف..." class="cargo-item-desc w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-200" required></td>
                <td class="p-1.5"><input type="number" step="any" min="0.01" value="${qtyVal}" class="cargo-item-qty w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-center text-zinc-200" required></td>
                <td class="p-1.5"><input type="number" step="any" min="0" value="${priceVal}" placeholder="0.00" oninput="calculateCargoTotal()" class="cargo-item-price w-full bg-zinc-900 border border-gold rounded p-2 text-xs text-gold font-bold" required></td>
                <td class="p-1.5 text-center"><button type="button" onclick="this.closest('tr').remove(); calculateCargoTotal();" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-trash"></i></button></td>
            `;
                tbody.appendChild(tr);
                calculateCargoTotal();
            }

            function calculateCargoTotal() {
                const priceInputs = document.querySelectorAll('.cargo-item-price');
                let sum = 0;
                priceInputs.forEach(inp => { sum += parseFloat(inp.value) || 0; });
                sum = Math.round(sum * 100) / 100;
                document.getElementById('cargoManualTotal').value = sum;
            }

            function handleSaveCargo(e) {
                e.preventDefault();
                const editId = document.getElementById('cargoEditId').value;
                const cId = document.getElementById('cargoInvNo').value.trim();
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                const items = [];
                const rows = document.querySelectorAll('#cargoItemsRowsContainer tr');
                rows.forEach(tr => {
                    items.push({
                        desc: tr.querySelector('.cargo-item-desc').value,
                        qty: parseFloat(tr.querySelector('.cargo-item-qty').value) || 1,
                        price: parseFloat(tr.querySelector('.cargo-item-price').value) || 0
                    });
                });

                const grandTotal = parseFloat(document.getElementById('cargoManualTotal').value) || 0;
                const tripId = document.getElementById('cargoTripSelect') ? document.getElementById('cargoTripSelect').value : '';
                const cDate = document.getElementById('cargoDate').value;
                const sender = document.getElementById('cargoSenderName').value;
                const sPhone = document.getElementById('cargoSenderPhone').value;
                const sAddr = document.getElementById('cargoSenderAddress').value;
                const receiver = document.getElementById('cargoReceiverName').value;
                const rPhone = document.getElementById('cargoReceiverPhone').value;
                const rAddr = document.getElementById('cargoReceiverAddress').value;
                const payStatus = document.getElementById('cargoPaymentStatus').value;
                const notes = document.getElementById('cargoNotes').value.trim();

                if (tripId) {
                    const selectedTrip = (db.trips || []).find(t => String(t.id) === String(tripId));
                    if (selectedTrip && selectedTrip.status === 'غادرت الرحلة') {
                        const canFinanceOverride = canModifyFinancialsOrAccounts() && (
                            String(financeOverrideDepartedTripId) === String(tripId) ||
                            (editId && db.cargo.some(x => String(x.id) === String(editId) && String(x.tripId) === String(tripId)))
                        );
                        if (!canFinanceOverride) {
                            alert('عذراً، هذه الرحلة غادرت! لا يمكن إضافة أو تعديل فاتورة شحن لها إلا عبر الإدارة المالية من جدول (الرحلات التي غادرت).');
                            return;
                        }
                    }
                }

                if (editId) {
                    const idx = db.cargo.findIndex(c => String(c.id) === String(editId));
                    if (idx !== -1) {
                        let oldObj = db.cargo[idx];
                        if (payStatus !== oldObj.paymentStatus && !canModifyFinancialsOrAccounts()) {
                            alert('عذراً، تغيير حالة السداد مسموح فقط لمحمود، المدير العام، أو المحاسب!');
                            return;
                        }
                        oldObj.id = cId;
                        oldObj.tripId = tripId;
                        oldObj.date = cDate;
                        oldObj.sender = sender;
                        oldObj.senderPhone = sPhone;
                        oldObj.senderAddress = sAddr;
                        oldObj.receiver = receiver;
                        oldObj.receiverPhone = rPhone;
                        oldObj.receiverAddress = rAddr;
                        oldObj.items = items;
                        oldObj.grandTotal = grandTotal;
                        oldObj.paymentStatus = payStatus;
                        oldObj.notes = notes;
                        oldObj.photos = [...currentCargoAttachments];
                        if (!oldObj.auditLog) oldObj.auditLog = [{ action: 'إنشاء الفاتورة', user: oldObj.createdBy || author, time: oldObj.createdAt || nowStr }];
                        oldObj.auditLog.push({ action: 'تعديل الفاتورة', user: author, time: nowStr });
                    }
                    financeOverrideDepartedTripId = null;
                    saveDB();
                    resetCargoForm();
                    refreshUI();
                    previewCargoImage(cId);
                    setTimeout(() => { downloadCapturedImage('cargoCaptureArea', getCargoFileName()); }, 600);
                } else {
                    const newCargo = {
                        id: cId,
                        tripId: tripId,
                        date: cDate,
                        sender: sender,
                        senderPhone: sPhone,
                        senderAddress: sAddr,
                        receiver: receiver,
                        receiverPhone: rPhone,
                        receiverAddress: rAddr,
                        items: items,
                        grandTotal: grandTotal,
                        paymentStatus: payStatus,
                        notes: notes,
                        photos: [...currentCargoAttachments],
                        branch: currentUser.branch || 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr,
                        auditLog: [{ action: 'إنشاء الفاتورة', user: author, time: nowStr }]
                    };
                    db.cargo.unshift(newCargo);
                    financeOverrideDepartedTripId = null;
                    saveDB();
                    resetCargoForm();
                    refreshUI();
                    previewCargoImage(cId);
                    setTimeout(() => { downloadCapturedImage('cargoCaptureArea', getCargoFileName()); }, 600);
                }
            }

            function editCargo(id) {
                const c = db.cargo.find(x => String(x.id) === String(id));
                if (!c) return;

                if (c.tripId) {
                    const trip = (db.trips || []).find(t => String(t.id) === String(c.tripId));
                    if (trip && trip.status === 'غادرت الرحلة' && !canModifyFinancialsOrAccounts()) {
                        alert('عذراً، هذه الفاتورة تابعة لرحلة مغادرة! لا يمكن تعديلها إلا من خلال الإدارة المالية.');
                        return;
                    }
                }

                document.getElementById('cargoEditId').value = c.id;
                document.getElementById('cargoInvNo').value = c.id;
                populateTripsDropdown();
                if (document.getElementById('cargoTripSelect')) document.getElementById('cargoTripSelect').value = c.tripId || '';
                document.getElementById('cargoDate').value = c.date;
                document.getElementById('cargoSenderName').value = c.sender;
                document.getElementById('cargoSenderPhone').value = c.senderPhone;
                document.getElementById('cargoSenderAddress').value = c.senderAddress;
                document.getElementById('cargoReceiverName').value = c.receiver;
                document.getElementById('cargoReceiverPhone').value = c.receiverPhone;
                document.getElementById('cargoReceiverAddress').value = c.receiverAddress;
                document.getElementById('cargoPaymentStatus').value = c.paymentStatus;
                document.getElementById('cargoNotes').value = c.notes || '';
                currentCargoAttachments = Array.isArray(c.photos) ? [...c.photos] : [];
                renderCargoFormImagesPreview();

                document.getElementById('cargoItemsRowsContainer').innerHTML = '';
                if (c.items && c.items.length > 0) {
                    c.items.forEach(item => addCargoItemRow(item.desc, item.qty, item.price));
                } else { addCargoItemRow(); }
                const totalInput = document.getElementById('cargoManualTotal');
                totalInput.value = c.grandTotal !== undefined && c.grandTotal !== null ? c.grandTotal : 0;

                document.getElementById('cargoFormTitle').innerText = `تعديل فاتورة الشحن #${c.id}`;
                document.getElementById('cargoSubmitBtn').innerText = 'حفظ تعديلات فاتورة الشحن';
                document.getElementById('cancelEditCargoBtn').classList.remove('hidden');

                document.getElementById('cargoEditAuditBox').classList.remove('hidden');
                renderAuditLogIntoBox(c.auditLog, c.createdBy, c.createdAt, 'cargoEditAuditList');

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function resetCargoForm() {
                document.getElementById('cargoForm').reset();
                document.getElementById('cargoEditId').value = '';
                document.getElementById('cargoNotes').value = '';
                document.getElementById('cargoItemsRowsContainer').innerHTML = '';
                addCargoItemRow();
                document.getElementById('cargoFormTitle').innerText = 'فاتورة أمتعة وبضائع (بأرقام كسرية دقيقة للأسعار)';
                document.getElementById('cargoSubmitBtn').innerText = 'حفظ فاتورة الشحن وتنزيل الصورة';
                document.getElementById('cancelEditCargoBtn').classList.add('hidden');
                document.getElementById('cargoEditAuditBox').classList.add('hidden');
                currentCargoAttachments = [];
                renderCargoFormImagesPreview();
                calculateNextSequenceNumbers();
            }

            function previewCargoImage(id) {
                const cargo = db.cargo.find(x => String(x.id) === String(id));
                if (!cargo) return;
                currentPreviewCargo = cargo;
                document.getElementById('imgCargoCode').innerText = `#${cargo.id}`;
                document.getElementById('imgCargoSenderName').innerText = cargo.sender;
                document.getElementById('imgCargoSenderPhone').innerText = cargo.senderPhone;
                document.getElementById('imgCargoSenderAddress').innerText = cargo.senderAddress || '-';
                document.getElementById('imgCargoReceiverName').innerText = cargo.receiver;
                document.getElementById('imgCargoReceiverPhone').innerText = cargo.receiverPhone;
                document.getElementById('imgCargoReceiverAddress').innerText = cargo.receiverAddress || '-';

                const tripObj = (db.trips || []).find(t => String(t.id) === String(cargo.tripId));
                const tripInfoEl = document.getElementById('imgCargoTripInfo');
                if (tripInfoEl) {
                    tripInfoEl.innerText = tripObj ? `${tripObj.date !== '-' ? tripObj.date : ''} (${tripObj.route}) - ${tripObj.busInfo}` : (cargo.date ? `تاريخ: ${cargo.date}` : 'غير مرتبطة برحلة محددة');
                }

                const notesBox = document.getElementById('imgCargoNotesBox');
                if (cargo.notes && cargo.notes.trim() !== '') {
                    document.getElementById('imgCargoNotes').innerText = cargo.notes;
                    notesBox.classList.remove('hidden');
                } else {
                    notesBox.classList.add('hidden');
                }

                const tbody = document.getElementById('imgCargoItemsTableBody');
                tbody.innerHTML = '';
                cargo.items.forEach((it, idx) => {
                    tbody.insertRow().innerHTML = `
                    <td class="border border-slate-300 p-1.5 text-center">${idx + 1}</td>
                    <td class="border border-slate-300 p-1.5 font-bold">${it.desc}</td>
                    <td class="border border-slate-300 p-1.5 text-center">${it.qty}</td>
                    <td class="border border-slate-300 p-1.5 text-left font-bold text-amber-700">${it.price} AED</td>
                `;
                });
                document.getElementById('imgCargoGrandTotal').innerText = `${cargo.grandTotal} AED`;
                document.getElementById('imgCargoPayStatus').innerText = cargo.paymentStatus;
                document.getElementById('cargoPreviewModal').classList.remove('hidden');
            }

            function openCargoManifestModal() {
                document.getElementById('cargoManifestFilterDate').value = new Date().toISOString().split('T')[0];
                renderCargoManifestTable();
                document.getElementById('cargoManifestModal').classList.remove('hidden');
            }

            function renderCargoManifestTable() {
                const targetDate = document.getElementById('cargoManifestFilterDate').value;
                document.getElementById('cargoManifestActiveDateBadge').innerText = targetDate || 'جميع التواريخ';
                document.getElementById('cargoManifestIssueDate').innerText = new Date().toLocaleDateString('ar-AE');

                let list = getFilteredData(db.cargo);
                if (targetDate) { list = list.filter(c => c.date === targetDate); }

                let totalRev = 0;
                const tbody = document.getElementById('cargoManifestTableBody');
                tbody.innerHTML = '';

                list.forEach((c, idx) => {
                    totalRev += c.grandTotal;
                    const itemsDesc = c.items.map(i => `${i.desc} (${i.qty})`).join(' + ');
                    tbody.insertRow().innerHTML = `
                    <td class="border border-slate-300 p-2 font-bold text-center">${idx + 1}</td>
                    <td class="border border-slate-300 p-2 font-bold text-indigo-800">#${c.id}</td>
                    <td class="border border-slate-300 p-2 font-bold">${c.sender}</td>
                    <td class="border border-slate-300 p-2 font-mono text-xs">${c.senderPhone || '-'}</td>
                    <td class="border border-slate-300 p-2 font-bold">${c.receiver}</td>
                    <td class="border border-slate-300 p-2 font-mono text-xs">${c.receiverPhone || '-'}</td>
                    <td class="border border-slate-300 p-2 text-xs font-bold">${c.receiverAddress || '-'}</td>
                    <td class="border border-slate-300 p-2 text-xs">${itemsDesc}</td>
                    <td class="border border-slate-300 p-2 font-bold text-amber-700 cargo-price-col">${c.grandTotal} AED</td>
                    <td class="border border-slate-300 p-2 font-bold">${c.paymentStatus}</td>
                `;
                });

                document.getElementById('cargoManifestTotalInvoices').innerText = list.length;
                document.getElementById('cargoManifestTotalRevenue').innerText = `${totalRev} AED`;
            }

            function printManifestCargo(mode) {
                const sub = document.getElementById('cargoManifestTypeSubtitle');
                const revBox = document.getElementById('cargoManifestRevBox');
                const priceCols = document.querySelectorAll('.cargo-price-col');
                if (mode === 'driver') {
                    sub.innerText = 'كشف مانفيستو الشحن الرسمي - نسخة السائق (بدون أسعار)';
                    revBox.style.display = 'none';
                    priceCols.forEach(c => c.style.display = 'none');
                } else {
                    sub.innerText = 'كشف مانفيستو الشحن الرسمي - نسخة الإدارة (بالأسعار)';
                    revBox.style.display = '';
                    priceCols.forEach(c => c.style.display = '');
                }
                printDocumentLandscape();
            }

            // ================= تأشيرات العبور واستخراج PDF.js (Oman eVisa) =================
            function toggleManualTransitForm() {
                const card = document.getElementById('transitManualFormCard');
                if (card) {
                    card.classList.toggle('hidden');
                    if (!card.classList.contains('hidden')) {
                        calculateNextSequenceNumbers();
                    }
                }
            }

            function handleTransitDragOver(e) {
                e.preventDefault();
                e.stopPropagation();
                const dz = document.getElementById('transitDropZone');
                if (dz) dz.classList.add('border-emerald-400', 'bg-zinc-900/80');
            }

            function handleTransitDragLeave(e) {
                e.preventDefault();
                e.stopPropagation();
                const dz = document.getElementById('transitDropZone');
                if (dz) dz.classList.remove('border-emerald-400', 'bg-zinc-900/80');
            }

            function handleTransitDrop(e) {
                e.preventDefault();
                e.stopPropagation();
                handleTransitDragLeave(e);
                const files = e.dataTransfer ? e.dataTransfer.files : null;
                if (files && files.length > 0) {
                    processTransitPdfFileList(files);
                }
            }

            function handleTransitPdfFiles(e) {
                const files = e.target ? e.target.files : null;
                if (files && files.length > 0) {
                    processTransitPdfFileList(files);
                }
                e.target.value = '';
            }

            function normalizeArabicExtractedText(raw) {
                if (!raw) return '';
                let cleaned = raw.normalize('NFKC').replace(/\u0640/g, '').replace(/\s+/g, ' ').trim();
                cleaned = cleaned.replace(/[؀-ۿ]{2,}/g, (word) => {
                    if (/^[ء-ي]+لا$/.test(word) && word.length > 3) {
                        return word.split('').reverse().join('');
                    }
                    return word;
                });
                return cleaned;
            }

            function parseOmanEvisaText(fullText) {
                const normalized = fullText.normalize('NFKC')
                    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
                    .replace(/\u0640/g, '')
                    .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) >= 0x06f0 ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660))
                    .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);

                let requestNo = '';
                const reqMatch = normalized.match(/\b(1000\d{4,10})\b/) ||
                    normalized.match(/(?:Application\s*(?:No|Number|Reference)|رقم\s*(?:طلب\s*التأشيرة|الطلب))\s*[:#\-]?\s*(\d{6,14})/i);
                if (reqMatch) requestNo = reqMatch[1];

                let passport = '';
                const passPatterns = [
                    /(?:رقم\s*(?:وثيقة\s*السفر|الجواز))\s*[:#\-]?\s*([A-Z0-9]{5,15})/i,
                    /(?:Travel\s*Document\s*(?:No|Number)|Passport\s*(?:No|Number)|Document\s*Number|رقم\s*وثيقة\s*السفر|رقم\s*الجواز)\s*[:\-]?\s*([A-Z0-9]{5,15})/i,
                    /([A-Z0-9]{5,15})\s*(?:Number\s*Document\s*Travel|Document\s*Number|Travel\s*Document|Passport|رقم\s*الجواز|رقم\s*وثيقة)/i
                ];
                for (const pat of passPatterns) {
                    const m = normalized.match(pat);
                    if (m && m[1] && m[1] !== requestNo && !/^1000\d+$/.test(m[1])) {
                        passport = m[1].toUpperCase();
                        break;
                    }
                }
                if (!passport) {
                    const fallbackPass = normalized.match(/\b([A-Z]{1,2}\d{6,9}|\d{7,9})\b/g);
                    if (fallbackPass) {
                        const visaNoMatch = normalized.match(/(?:Visa\s*Number|رقم\s*التأشيرة)\s*[:#\-]?\s*(\d{5,15})/i) ||
                            normalized.match(/(\d{5,15})\s*(?:Number\s*Visa)/i);
                        const visaNo = visaNoMatch ? visaNoMatch[1] : '';
                        const candidate = fallbackPass.find(code => code !== requestNo && code !== visaNo && !code.startsWith('1000') && !/^20\d{6,}$/.test(code));
                        if (candidate) passport = candidate;
                    }
                }

                let arabicName = '';
                const nameLabelMatch = normalized.match(/(?:(?:الاسم|الإسم)\s*الكامل(?:\s*(?:باللغة\s*العربية|بالعربية))?|Full\s*Name)\s*[:\-]?\s*([\u0600-\u06FF\s]{5,100})/i);
                if (nameLabelMatch && nameLabelMatch[1]) {
                    const nameCandidate = nameLabelMatch[1].replace(/^(?:باللغة\s*العربية\s*)/i, '');
                    const nameWords = nameCandidate.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){1,6}/);
                    if (nameWords) arabicName = normalizeArabicExtractedText(nameWords[0]);
                }
                if (!arabicName) {
                    const ignoreWords = [
                        'شرطة عمان', 'السلطانية', 'سلطنة عمان', 'تأشيرة', 'إيصال', 'دفع',
                        'الادارة العامة', 'الإدارة العامة', 'الجوازات', 'الأحوال المدنية',
                        'رقم الطلب', 'تاريخ', 'الجنسية', 'نوع التأشيرة', 'صالح لغاية', 'تأشيرة عبور',
                        'الموافقة', 'يرجى', 'التأكد', 'صلاحيتها', 'والدخول', 'تمت'
                    ];
                    for (const line of lines) {
                        const arabicSegments = line.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){1,6}/g);
                        if (arabicSegments) {
                            for (const seg of arabicSegments) {
                                const cleanSeg = normalizeArabicExtractedText(seg);
                                if (cleanSeg.split(' ').length >= 2 && !ignoreWords.some(w => cleanSeg.includes(w))) {
                                    arabicName = cleanSeg;
                                    break;
                                }
                            }
                        }
                        if (arabicName) break;
                    }
                }
                if (!arabicName) {
                    const givenNames = normalized.match(/([A-Z][A-Z\s'-]{2,50})\s*Given\s*Name(?:\(s\))?/i);
                    const familyName = normalized.match(/([A-Z][A-Z\s'-]{2,40})\s*Family\s*Name/i);
                    if (givenNames && familyName) {
                        arabicName = `${givenNames[1].trim()} ${familyName[1].trim()}`.replace(/\s+/g, ' ');
                    }
                }

                let approvalDate = '';
                const isReceipt = /(?:Payment\s*Receipt|Receipt\s*No|إيصال\s*دفع|سند\s*دفع)/i.test(normalized) &&
                    !/(?:Approved|Visa\s*Validity|تاريخ\s*الموافقة|صالح\s*حتى|تأشيرة\s*إلكترونية)/i.test(normalized);

                if (!isReceipt) {
                    const dateLabelMatch = normalized.match(/(?:Approval\s*Date|Issue\s*Date|Approved\s*on|تاريخ\s*الموافقة(?:\s*على\s*طلب\s*التأشيرة)?|تاريخ\s*الإصدار)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i);
                    if (dateLabelMatch) {
                        approvalDate = dateLabelMatch[1];
                    } else if (/(?:تأشيرة|Visa|Approved|موافق)/i.test(normalized)) {
                        const anyDate = normalized.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]20\d{2}|20\d{2}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/);
                        if (anyDate) approvalDate = anyDate[1];
                    }
                }

                return {
                    name: arabicName,
                    requestNo,
                    passport: passport || '-',
                    approvalDate: approvalDate,
                    appStatus: approvalDate ? 'صادرة' : 'قيد الانتظار',
                    rawText: normalized
                };
            }

            async function processTransitPdfFileList(fileList) {
                if (!db.transitVisas) db.transitVisas = [];
                const progressBox = document.getElementById('transitPdfProgress');
                const progressText = document.getElementById('transitPdfProgressText');
                if (progressBox) progressBox.classList.remove('hidden');

                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                let addedCount = 0;
                const files = Array.from(fileList || []);
                try {
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        if (progressText) progressText.innerText = `جاري تحليل الملف (${i + 1} من ${files.length}): ${file.name}`;
                        if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
                            alert(`تم تجاهل الملف (${file.name}) لأنه ليس ملف PDF.`);
                            continue;
                        }

                        let pdfDoc = null;
                        try {
                            const arrayBuffer = await file.arrayBuffer();
                            pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                            let fullText = '';
                            for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
                                const page = await pdfDoc.getPage(pageNumber);
                                const textContent = await page.getTextContent();
                                const lineBuckets = new Map();
                                for (const item of textContent.items) {
                                    if (!item.str || !item.str.trim()) continue;
                                    const x = item.transform ? item.transform[4] : 0;
                                    const y = item.transform ? Math.round(item.transform[5] / 5) * 5 : 0;
                                    if (!lineBuckets.has(y)) lineBuckets.set(y, []);
                                    lineBuckets.get(y).push({ x, text: item.str.trim() });
                                }
                                const yPositions = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
                                for (const y of yPositions) {
                                    const line = lineBuckets.get(y).sort((a, b) => b.x - a.x);
                                    fullText += line.map(part => part.text).join(' ') + '\n';
                                }
                            }

                            if (!fullText.trim()) {
                                alert(`الملف (${file.name}) لا يحتوي على نص قابل للاستخراج. قد يكون PDF ممسوحاً ضوئياً ويحتاج إلى OCR.`);
                                continue;
                            }

                            const parsed = parseOmanEvisaText(fullText);
                            calculateNextSequenceNumbers();
                            const nextId = String(db.nextTransitNo || (db.transitVisas.length + 1));
                            const newVisa = {
                                id: nextId,
                                agent: 'Oman eVisa',
                                name: parsed.name,
                                passport: parsed.passport,
                                identity: 'زيارة',
                                requestNo: parsed.requestNo,
                                approvalDate: parsed.approvalDate,
                                appStatus: parsed.appStatus,
                                amount: 150,
                                paymentStatus: parsed.approvalDate ? 'تم الدفع والاصدار' : 'غير مدفوع',
                                rawText: parsed.rawText,
                                fileName: file.name,
                                date: new Date().toISOString().split('T')[0],
                                branch: currentUser ? (currentUser.branch || 'فرع عجمان') : 'فرع عجمان',
                                createdBy: author,
                                createdAt: nowStr,
                                auditLog: [{ action: `استخراج تلقائي من PDF (${file.name})`, user: author, time: nowStr }]
                            };
                            db.transitVisas.unshift(newVisa);
                            addedCount++;
                        } catch (err) {
                            console.error('Error parsing PDF:', file.name, err);
                            alert(`تعذر تحليل الملف (${file.name}): ${err.message || err}`);
                        } finally {
                            if (pdfDoc) await pdfDoc.destroy();
                        }
                    }
                } finally {
                    if (progressBox) progressBox.classList.add('hidden');
                }

                if (addedCount > 0) {
                    saveDB();
                    refreshUI();
                    alert(`تم تحليل واستخراج بيانات (${addedCount}) مستند بنجاح!`);
                }
            }

            function loadSampleTransitVisas() {
                if (!db.transitVisas) db.transitVisas = [];
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                calculateNextSequenceNumbers();
                let baseId = db.nextTransitNo || 1;

                const samples = [
                    {
                        id: String(baseId),
                        agent: 'مباشر',
                        name: 'عبدالله محمد سالم الكعبي',
                        passport: 'P09845123',
                        identity: 'زيارة',
                        requestNo: '10008492',
                        approvalDate: '20-11-2026',
                        appStatus: 'صادرة',
                        amount: 150,
                        paymentStatus: 'تم الدفع والاصدار',
                        rawText: `Royal Oman Police - eVisa
Application No: 10008492
Name: عبدالله محمد سالم الكعبي
Travel Document Number: P09845123
Approval Date: 20-11-2026`,
                        date: new Date().toISOString().split('T')[0],
                        branch: currentUser ? (currentUser.branch || 'فرع عجمان') : 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr
                    },
                    {
                        id: String(baseId + 1),
                        agent: 'أبو خالد',
                        name: 'فاطمة علي حسين المقطري',
                        passport: '12457896',
                        identity: 'مقيم',
                        requestNo: '10008519',
                        approvalDate: '',
                        appStatus: 'قيد الانتظار',
                        amount: 80,
                        paymentStatus: 'غير مدفوع',
                        rawText: `Royal Oman Police - Payment Receipt
Application No: 10008519
Name: فاطمة علي حسين المقطري
Travel Document Number: 12457896
Status: Payment Received - Pending Approval`,
                        date: new Date().toISOString().split('T')[0],
                        branch: currentUser ? (currentUser.branch || 'فرع عجمان') : 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr
                    }
                ];

                db.transitVisas.unshift(...samples);
                saveDB();
                refreshUI();
            }

            function onTransitIdentityChange() {
                const idType = document.getElementById('transitIdentity').value;
                const amountInp = document.getElementById('transitAmount');
                const amountLbl = document.getElementById('transitAmountLabel');
                if (idType === 'زيارة') {
                    amountInp.min = 150;
                    amountInp.max = 200;
                    if (!document.getElementById('transitEditId').value) amountInp.value = 150;
                    amountLbl.innerText = 'المبلغ (درهم - 150 إلى 200) *';
                } else {
                    amountInp.min = 80;
                    amountInp.max = 100;
                    if (!document.getElementById('transitEditId').value) amountInp.value = 80;
                    amountLbl.innerText = 'المبلغ (درهم - 80 إلى 100) *';
                }
            }

            function handleSaveTransit(e) {
                e.preventDefault();
                if (!db.transitVisas) db.transitVisas = [];
                const editId = document.getElementById('transitEditId').value;
                const invNo = document.getElementById('transitInvNo').value.trim();
                const agent = document.getElementById('transitAgent').value.trim();
                const name = document.getElementById('transitName').value.trim();
                const passport = document.getElementById('transitPassport').value.trim();
                const identity = document.getElementById('transitIdentity').value;
                const requestNo = document.getElementById('transitRequestNo').value.trim();
                const approvalDate = (document.getElementById('transitApprovalDate')?.value || '').trim();
                const appStatus = approvalDate ? 'صادرة' : (document.getElementById('transitAppStatus')?.value || 'قيد الانتظار');
                const amount = parseFloat(document.getElementById('transitAmount').value) || 0;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();

                if (editId) {
                    const idx = db.transitVisas.findIndex(x => String(x.id) === String(editId));
                    if (idx !== -1) {
                        let oldObj = db.transitVisas[idx];
                        oldObj.id = invNo;
                        oldObj.agent = agent;
                        oldObj.name = name;
                        oldObj.passport = passport;
                        oldObj.identity = identity;
                        oldObj.requestNo = requestNo;
                        oldObj.approvalDate = approvalDate;
                        oldObj.appStatus = appStatus;
                        oldObj.amount = amount;
                        if (!oldObj.auditLog) oldObj.auditLog = [{ action: 'إنشاء فاتورة تأشيرة عبور', user: oldObj.createdBy || author, time: oldObj.createdAt || nowStr }];
                        oldObj.auditLog.push({ action: 'تعديل فاتورة تأشيرة عبور', user: author, time: nowStr });
                    }
                    alert('تم تحديث سجل تأشيرة العبور بنجاح!');
                    resetTransitForm();
                    document.getElementById('transitManualFormCard').classList.add('hidden');
                } else {
                    if (db.transitVisas.some(x => String(x.id) === String(invNo))) {
                        alert('رقم الفاتورة مسجل مسبقاً! يرجى اختيار رقم فاتورة آخر.');
                        return;
                    }
                    const newVisa = {
                        id: invNo,
                        agent: agent,
                        name: name,
                        passport: passport,
                        identity: identity,
                        requestNo: requestNo,
                        approvalDate: approvalDate,
                        appStatus: appStatus,
                        amount: amount,
                        paymentStatus: approvalDate ? 'تم الدفع والاصدار' : 'غير مدفوع',
                        date: new Date().toISOString().split('T')[0],
                        branch: currentUser.branch || 'فرع عجمان',
                        createdBy: author,
                        createdAt: nowStr,
                        auditLog: [{ action: 'إنشاء فاتورة تأشيرة عبور', user: author, time: nowStr }]
                    };
                    db.transitVisas.unshift(newVisa);
                    alert('تم حفظ سجل تأشيرة العبور بنجاح!');
                    resetTransitForm();
                    document.getElementById('transitManualFormCard').classList.add('hidden');
                }

                saveDB();
                refreshUI();
            }

            function updateTransitInlineField(id, field, value) {
                if (!db.transitVisas) return;
                const idx = db.transitVisas.findIndex(x => String(x.id) === String(id));
                if (idx === -1) return;

                const item = db.transitVisas[idx];
                item[field] = value;

                if (field === 'approvalDate') {
                    const trimmed = String(value || '').trim();
                    item.appStatus = trimmed ? 'صادرة' : 'قيد الانتظار';
                }

                saveDB();
                if (field === 'approvalDate' || field === 'appStatus') {
                    renderTransitTable();
                }
            }

            function updateTransitPaymentStatus(id, newStatus) {
                if (!db.transitVisas) return;
                const idx = db.transitVisas.findIndex(x => String(x.id) === String(id));
                if (idx === -1) return;

                const oldStatus = db.transitVisas[idx].paymentStatus;
                if (oldStatus !== newStatus && !canModifyFinancialsOrAccounts()) {
                    alert('عذراً، تغيير حالة السداد مسموح فقط لمحمود، المدير العام، أو المحاسب!');
                    refreshUI();
                    return;
                }
                db.transitVisas[idx].paymentStatus = newStatus;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                if (!db.transitVisas[idx].auditLog) db.transitVisas[idx].auditLog = [];
                db.transitVisas[idx].auditLog.push({ action: `تحديث حالة السداد إلى: ${newStatus}`, user: author, time: nowStr });
                saveDB();
                refreshUI();
            }

            function editTransitVisa(id) {
                const item = (db.transitVisas || []).find(x => String(x.id) === String(id));
                if (!item) return;

                document.getElementById('transitManualFormCard').classList.remove('hidden');
                document.getElementById('transitEditId').value = item.id;
                document.getElementById('transitInvNo').value = item.id;
                document.getElementById('transitAgent').value = item.agent || '';
                document.getElementById('transitName').value = item.name || '';
                document.getElementById('transitPassport').value = item.passport || '';
                document.getElementById('transitIdentity').value = item.identity || 'زيارة';
                onTransitIdentityChange();
                document.getElementById('transitRequestNo').value = item.requestNo || '';
                if (document.getElementById('transitApprovalDate')) document.getElementById('transitApprovalDate').value = item.approvalDate || '';
                if (document.getElementById('transitAppStatus')) document.getElementById('transitAppStatus').value = item.appStatus || 'قيد الانتظار';
                document.getElementById('transitAmount').value = item.amount || 150;

                document.getElementById('transitFormTitle').innerText = `تعديل سجل تأشيرة العبور #${item.id}`;
                document.getElementById('transitSubmitBtn').innerText = 'حفظ التعديلات';

                const auditBox = document.getElementById('transitEditAuditBox');
                if (auditBox) {
                    auditBox.classList.remove('hidden');
                    renderAuditLogIntoBox(item.auditLog, item.createdBy, item.createdAt, 'transitEditAuditList');
                }

                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function resetTransitForm() {
                document.getElementById('transitForm').reset();
                document.getElementById('transitEditId').value = '';
                document.getElementById('transitIdentity').value = 'زيارة';
                onTransitIdentityChange();
                document.getElementById('transitFormTitle').innerText = 'إضافة / تعديل سجل تأشيرة عبور';
                document.getElementById('transitSubmitBtn').innerText = 'حفظ السجل في قاعدة البيانات';
                const auditBox = document.getElementById('transitEditAuditBox');
                if (auditBox) auditBox.classList.add('hidden');
                calculateNextSequenceNumbers();
            }

            function viewTransitRawText(id) {
                const item = (db.transitVisas || []).find(x => String(x.id) === String(id));
                if (!item) return;
                const pre = document.getElementById('transitRawTextContent');
                if (pre) {
                    pre.innerText = item.rawText || `سجل يدوي:
الاسم: ${item.name}
رقم الطلب: ${item.requestNo}
الجواز: ${item.passport}
تاريخ الموافقة: ${item.approvalDate || 'غير متوفر'}`;
                }
                document.getElementById('transitRawTextModal').classList.remove('hidden');
            }

            function copySingleTransitRow(id) {
                const item = (db.transitVisas || []).find(x => String(x.id) === String(id));
                if (!item) return;
                const statusOrDate = item.approvalDate ? item.approvalDate : (item.appStatus || 'قيد الانتظار');
                const rowText = `${item.name}	${item.requestNo}	${item.passport}	${statusOrDate}`;
                navigator.clipboard.writeText(rowText).then(() => {
                    alert(`تم نسخ بيانات (${item.name}) إلى الحافظة!`);
                });
            }

            function copyTransitTableToClipboard() {
                const list = getFilteredTransitList();
                if (list.length === 0) { alert('الجدول فارغ!'); return; }
                const header = ['الاسم بالعربية', 'رقم الطلب', 'رقم الجواز', 'تاريخ الموافقة / الحالة', 'المبلغ', 'حالة السداد'].join('	');
                const rows = list.map(item => [
                    item.name,
                    item.requestNo,
                    item.passport,
                    item.approvalDate ? item.approvalDate : (item.appStatus || 'قيد الانتظار'),
                    item.amount,
                    item.paymentStatus
                ].join('	'));
                navigator.clipboard.writeText([header, ...rows].join('\n')).then(() => {
                    alert(`تم نسخ (${list.length}) صف إلى الحافظة بنجاح!`);
                });
            }

            function exportTransitCSV() {
                const list = getFilteredTransitList();
                const headers = ['رقم الفاتورة', 'الاسم بالعربية', 'رقم الطلب', 'رقم الجواز', 'تاريخ الموافقة', 'الحالة', 'الهوية', 'المبلغ', 'حالة السداد'];
                const rows = list.map(t => [
                    t.id,
                    `"${(t.name || '').replace(/"/g, '""')}"`,
                    t.requestNo,
                    t.passport,
                    t.approvalDate || '',
                    t.appStatus || (t.approvalDate ? 'صادرة' : 'قيد الانتظار'),
                    t.identity,
                    t.amount,
                    t.paymentStatus
                ].join(','));
                const csvContent = '﻿' + [headers.join(','), ...rows].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Oman_eVisa_Transit_${Date.now()}.csv`;
                link.click();
            }

            function printTransitTableOnly() {
                const list = getFilteredTransitList();
                const printWin = window.open('', '_blank', 'width=1000,height=700');
                if (!printWin) return;
                const rowsHtml = list.map((item, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${item.name}</strong></td>
                    <td style="font-family:monospace;">${item.requestNo}</td>
                    <td style="font-family:monospace;">${item.passport}</td>
                    <td>${item.approvalDate ? `<strong style="color:#065f46;">${item.approvalDate}</strong>` : `<span style="color:#b45309;">${item.appStatus || 'قيد الانتظار'}</span>`}</td>
                    <td>${item.amount} AED</td>
                    <td>${item.paymentStatus}</td>
                </tr>
            `).join('');

                printWin.document.write(`
                <html dir="rtl" lang="ar">
                <head>
                    <title>كشف تأشيرات العبور - Oman eVisa</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Cairo', sans-serif; padding: 15px; color: #111; }
                        h2 { margin: 0 0 5px 0; color: #991b1b; }
                        table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
                        th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: right; }
                        th { background: #f1f5f9; font-weight: 800; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <h2>شركة وادي بناء للنقل الدولي - كشف تأشيرات العبور (Oman eVisa)</h2>
                    <div style="font-size:11px; color:#555;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-AE')} | إجمالي السجلات: ${list.length}</div>
                    <table>
                        <thead>
                            <tr>
                                <th>م</th>
                                <th>الاسم الكامل بالعربية</th>
                                <th>رقم الطلب</th>
                                <th>رقم الجواز / الوثيقة</th>
                                <th>تاريخ الموافقة / الحالة</th>
                                <th>المبلغ</th>
                                <th>حالة السداد</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
                </html>
            `);
                printWin.document.close();
            }

            function clearAllTransitRecords() {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، مسح جميع السجلات متاح للمدير العام أو محمود فقط!');
                    return;
                }
                if (confirm('هل أنت متأكد من مسح جميع سجلات تأشيرات العبور؟')) {
                    db.transitVisas = [];
                    saveDB();
                    refreshUI();
                }
            }

            function getFilteredTransitList() {
                let list = getFilteredData(db.transitVisas || []);
                const q = (document.getElementById('transitSearchInput')?.value || '').toLowerCase().trim();
                const stFilter = document.getElementById('transitStatusFilter')?.value || 'ALL';

                if (q) {
                    list = list.filter(item =>
                        (item.name && item.name.toLowerCase().includes(q)) ||
                        (item.requestNo && String(item.requestNo).toLowerCase().includes(q)) ||
                        (item.passport && String(item.passport).toLowerCase().includes(q)) ||
                        (item.agent && item.agent.toLowerCase().includes(q))
                    );
                }

                if (stFilter === 'APPROVED') {
                    list = list.filter(item => item.approvalDate && String(item.approvalDate).trim() !== '');
                } else if (stFilter !== 'ALL') {
                    list = list.filter(item => !item.approvalDate && (item.appStatus || 'قيد الانتظار') === stFilter);
                }

                list.sort(compareInvoiceIdsDesc);
                return list;
            }

            function renderTransitTable() {
                const tbody = document.querySelector('#transitTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const list = getFilteredTransitList();
                const badge = document.getElementById('transitTotalBadge');
                if (badge) badge.innerText = `${list.length} سجلات`;

                const canEditPay = canModifyFinancialsOrAccounts();

                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-zinc-500 py-6">لا توجد سجلات مطابقة. اسحب ملفات PDF للتأشيرات أعلاه أو اضغط على "تحميل بيانات تجريبية".</td></tr>`;
                    return;
                }

                list.forEach((item) => {
                    const realIdx = (db.transitVisas || []).findIndex(x => String(x.id) === String(item.id));
                    const hasApproval = item.approvalDate && String(item.approvalDate).trim() !== '';
                    const currentAppStatus = item.appStatus || 'قيد الانتظار';

                    let appStatusBadgeColor = 'bg-amber-950 text-amber-300 border-amber-600';
                    if (currentAppStatus === 'معادة') appStatusBadgeColor = 'bg-sky-950 text-sky-300 border-sky-600';
                    else if (currentAppStatus === 'مرفوضة') appStatusBadgeColor = 'bg-red-950 text-red-300 border-red-600';

                    const approvalOrStatusHtml = hasApproval
                        ? `<div class="flex items-center gap-1">
                           <span class="text-emerald-400 text-xs"><i class="fa-solid fa-circle-check"></i></span>
                           <input type="text" value="${item.approvalDate}" onchange="updateTransitInlineField('${item.id}', 'approvalDate', this.value)" title="تعديل تاريخ الموافقة أو مسحه لتحويله لحالة انتظار" class="bg-emerald-950/60 border border-emerald-600/50 text-emerald-300 font-bold rounded-lg px-2 py-1 text-xs w-28 text-center outline-none">
                       </div>`
                        : `<select onchange="updateTransitInlineField('${item.id}', 'appStatus', this.value)" class="border rounded-lg px-2.5 py-1 text-xs font-bold outline-none ${appStatusBadgeColor}">
                           <option value="قيد الانتظار" ${currentAppStatus === 'قيد الانتظار' ? 'selected' : ''}>⏳ قيد الانتظار</option>
                           <option value="معادة" ${currentAppStatus === 'معادة' ? 'selected' : ''}>🔄 معادة</option>
                           <option value="مرفوضة" ${currentAppStatus === 'مرفوضة' ? 'selected' : ''}>❌ مرفوضة</option>
                       </select>`;

                    const statusVal = item.paymentStatus || 'غير مدفوع';
                    let payStyle = 'bg-red-950 text-red-300 border-red-700';
                    if (statusVal === 'تم الدفع والاصدار') payStyle = 'bg-emerald-950 text-emerald-300 border-emerald-600';
                    else if (statusVal === 'اجل') payStyle = 'bg-amber-950 text-amber-300 border-amber-600';

                    const payControl = canEditPay
                        ? `<select onchange="updateTransitPaymentStatus('${item.id}', this.value)" class="border rounded-lg px-2 py-1 text-xs font-bold outline-none ${payStyle}">
                            <option value="تم الدفع والاصدار" ${statusVal === 'تم الدفع والاصدار' ? 'selected' : ''}>تم الدفع والاصدار</option>
                            <option value="اجل" ${statusVal === 'اجل' ? 'selected' : ''}>اجل</option>
                            <option value="غير مدفوع" ${statusVal === 'غير مدفوع' ? 'selected' : ''}>غير مدفوع</option>
                       </select>`
                        : `<span class="border rounded-lg px-2 py-1 text-xs font-bold inline-block ${payStyle}">${statusVal}</span>`;

                    tbody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${item.id}</strong></td>
                    <td>
                        <input type="text" value="${item.name || ''}" onchange="updateTransitInlineField('${item.id}', 'name', this.value)" class="bg-transparent hover:bg-zinc-900 focus:bg-zinc-900 border border-transparent focus:border-gold rounded px-2 py-1 text-xs font-bold text-zinc-100 w-full min-w-[160px] outline-none">
                    </td>
                    <td>
                        <input type="text" value="${item.requestNo || ''}" onchange="updateTransitInlineField('${item.id}', 'requestNo', this.value)" class="bg-zinc-900/80 border border-zinc-700 focus:border-gold rounded px-2 py-1 text-xs font-mono text-amber-300 font-bold w-28 outline-none">
                    </td>
                    <td>
                        <input type="text" value="${item.passport || ''}" onchange="updateTransitInlineField('${item.id}', 'passport', this.value)" class="bg-zinc-900/80 border border-zinc-700 focus:border-gold rounded px-2 py-1 text-xs font-mono text-zinc-200 w-28 outline-none">
                    </td>
                    <td>${approvalOrStatusHtml}</td>
                    <td class="whitespace-nowrap">
                        <span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-[11px] font-bold ml-1">${item.identity || 'زيارة'}</span>
                        <strong class="text-emerald-400 text-xs">${item.amount} AED</strong>
                    </td>
                    <td>${payControl}</td>
                    <td class="space-x-1 space-x-reverse whitespace-nowrap no-print">
                        <button type="button" onclick="viewTransitRawText('${item.id}')" title="معاينة النص الخام للمستند" class="bg-zinc-800 hover:bg-zinc-700 text-sky-400 px-2 py-1 rounded text-xs"><i class="fa-solid fa-eye"></i></button>
                        <button type="button" onclick="copySingleTransitRow('${item.id}')" title="نسخ الصف" class="bg-zinc-800 hover:bg-zinc-700 text-indigo-400 px-2 py-1 rounded text-xs"><i class="fa-solid fa-copy"></i></button>
                        <button type="button" onclick="editTransitVisa('${item.id}')" title="تعديل كامل" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" onclick="deleteRecord('transitVisas', ${realIdx})" title="حذف" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                });
            }

            function exportTransitExcel() {
                const list = getFilteredTransitList().map(t => ({
                    'رقم الفاتورة': t.id,
                    'الاسم بالعربية': t.name,
                    'رقم الطلب': t.requestNo,
                    'رقم الجواز': t.passport,
                    'تاريخ الموافقة': t.approvalDate || '',
                    'الحالة': t.appStatus || (t.approvalDate ? 'صادرة' : 'قيد الانتظار'),
                    'الوكيل': t.agent,
                    'الهوية': t.identity,
                    'المبلغ': t.amount,
                    'حالة السداد': t.paymentStatus
                }));
                const ws = XLSX.utils.json_to_sheet(list);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'TransitVisas');
                XLSX.writeFile(wb, `Oman_eVisa_Transit_${Date.now()}.xlsx`);
            }

            // ================= الإدارة المالية وسندات القبض والذمم =================
            function handleSaveVoucher(e) {
                e.preventDefault();
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالتعديل في الحسابات!'); return; }
                const v = {
                    id: Date.now().toString(),
                    type: document.getElementById('vType').value,
                    date: document.getElementById('vDate').value,
                    amount: parseFloat(document.getElementById('vAmount').value) || 0,
                    receiver: document.getElementById('vReceiver').value.trim(),
                    desc: document.getElementById('vDesc').value,
                    user: getCurrentUserName(),
                    createdBy: getCurrentUserName(),
                    branch: currentUser.branch || 'فرع عجمان'
                };
                db.vouchers.unshift(v);
                saveDB();
                document.getElementById('voucherForm').reset();
                document.getElementById('vDate').value = new Date().toISOString().split('T')[0];
                refreshUI();
            }

            function renderVouchersTable() {
                const tbody = document.querySelector('#vouchersTable tbody');
                tbody.innerHTML = '';
                const filteredVouchers = getFilteredData(db.vouchers);
                filteredVouchers.forEach((v) => {
                    const realIdx = db.vouchers.findIndex(x => x.id === v.id);
                    const badge = v.type === 'قبض' ? '<span class="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-bold">سند قبض</span>' : '<span class="bg-red-950 text-red-400 px-2 py-0.5 rounded font-bold">سند صرف</span>';
                    tbody.insertRow().innerHTML = `
                    <td>${badge}</td>
                    <td>${v.date}</td>
                    <td><strong>${v.receiver || '-'}</strong></td>
                    <td>${v.desc}</td>
                    <td class="font-bold">${v.amount} AED</td>
                    <td><span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">${v.branch || 'فرع عجمان'}</span></td>
                    <td><button onclick="deleteRecord('vouchers', ${realIdx})" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-trash"></i></button></td>
                `;
                });
            }

            function handleSaveDebtInvoice(e) {
                e.preventDefault();
                if (!canModifyFinancialsOrAccounts()) { alert('غير مصرح لك بالتعديل في الحسابات!'); return; }
                const subTotal = parseFloat(document.getElementById('debtInvSubTotal').value) || 0;
                const paid = parseFloat(document.getElementById('debtInvPaidAmount').value) || 0;
                const rem = parseFloat(document.getElementById('debtInvNetTotal').value) || (subTotal - paid);
                const dId = document.getElementById('debtInvNo').value.trim();
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();

                const debtInv = {
                    id: dId,
                    date: document.getElementById('debtInvDate').value,
                    customerName: document.getElementById('debtInvCustomerName').value,
                    customerPhone: document.getElementById('debtInvCustomerPhone').value,
                    customerAddress: document.getElementById('debtInvCustomerAddress').value,
                    subTotal: subTotal,
                    paid: paid,
                    remaining: rem,
                    branch: currentUser.branch || 'فرع عجمان',
                    createdBy: author,
                    createdAt: nowStr,
                    auditLog: [{ action: 'إنشاء فاتورة آجل', user: author, time: nowStr }]
                };
                db.debtInvoices.unshift(debtInv);
                saveDB();
                document.getElementById('debtInvoiceForm').reset();
                switchFinancialSubTab('debts');
                refreshUI();
                previewDebtInvoice(dId);
            }

            function previewDebtInvoice(id) {
                const d = db.debtInvoices.find(x => String(x.id) === String(id));
                if (!d) return;
                currentPreviewDebt = d;
                document.getElementById('imgDebtInvCode').innerText = `#${d.id}`;
                document.getElementById('imgDebtName').innerText = d.customerName;
                document.getElementById('imgDebtPhone').innerText = d.customerPhone;
                document.getElementById('imgDebtAddress').innerText = d.customerAddress || '-';
                document.getElementById('imgDebtDate').innerText = d.date;
                document.getElementById('imgDebtSubTotal').innerText = d.subTotal;
                document.getElementById('imgDebtPaid').innerText = d.paid;
                document.getElementById('imgDebtNetTotal').innerText = `${d.remaining} AED`;
                document.getElementById('debtInvPreviewModal').classList.remove('hidden');
            }

            function renderDebtInvoicesTable() {
                const tbody = document.querySelector('#debtInvoicesTable tbody');
                tbody.innerHTML = '';
                let filteredDebts = getFilteredData(db.debtInvoices);
                filteredDebts.sort(compareInvoiceIdsDesc);
                filteredDebts.forEach((d) => {
                    const realIdx = db.debtInvoices.findIndex(x => String(x.id) === String(d.id));
                    tbody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${d.id}</strong></td>
                    <td>${d.date}</td>
                    <td>${d.customerName}</td>
                    <td>${d.customerPhone}</td>
                    <td>${d.subTotal} AED</td>
                    <td class="text-emerald-400">${d.paid} AED</td>
                    <td class="text-amber-400 font-bold">${d.remaining} AED</td>
                    <td><span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">${d.branch || 'فرع عجمان'}</span></td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="previewDebtInvoice('${d.id}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                        <button onclick="deleteRecord('debtInvoices', ${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
                });
            }

            function renderFinancials() {
                const filteredPass = getFilteredData(db.passengers);
                const filteredCargo = getFilteredData(db.cargo);
                const filteredVouchers = getFilteredData(db.vouchers);
                const filteredDrivers = getFilteredData(db.drivers);

                const ticketPaidRev = filteredPass.filter(p => p.payMethod === 'مدفوع').reduce((s, p) => s + (p.fare || 0), 0);
                const cargoPaidRev = filteredCargo.filter(c => c.paymentStatus === 'مدفوع').reduce((s, c) => s + c.grandTotal, 0);
                const transitPaidRev = getFilteredData(db.transitVisas || []).filter(t => t.paymentStatus === 'تم الدفع والاصدار').reduce((s, t) => s + (t.amount || 0), 0);
                const totalRev = ticketPaidRev + cargoPaidRev + transitPaidRev;

                const driverExp = filteredDrivers.reduce((s, d) => s + (d.totalExpenses || 0), 0);
                const voucherExp = filteredVouchers.filter(v => v.type === 'صرف').reduce((s, v) => s + v.amount, 0);
                const voucherRec = filteredVouchers.filter(v => v.type === 'قبض').reduce((s, v) => s + v.amount, 0);

                document.getElementById('finRevSum').innerText = `${totalRev} AED`;
                document.getElementById('finDriverExpSum').innerText = `${driverExp} AED`;
                document.getElementById('finExpensesSum').innerText = `${voucherExp} AED`;
                document.getElementById('finNetBoxSum').innerText = `${(totalRev + voucherRec) - (driverExp + voucherExp)} AED`;

                renderDepartedTripsFinanceTable();
                renderDailyCashClosingReport();
            }

            // ================= إغلاق الصندوق اليومي وتصفية الوردية =================
            function renderDailyCashClosingReport() {
                const dateInp = document.getElementById('dailyCloseDate');
                if (!dateInp) return;
                const targetDate = dateInp.value || new Date().toISOString().split('T')[0];

                const filteredPass = getFilteredData(db.passengers).filter(p => p.date === targetDate && p.payMethod === 'مدفوع');
                const filteredCargo = getFilteredData(db.cargo).filter(c => c.date === targetDate && c.paymentStatus === 'مدفوع');
                const filteredTransit = getFilteredData(db.transitVisas || []).filter(t => t.date === targetDate && t.paymentStatus === 'تم الدفع والاصدار');
                const filteredVouchers = getFilteredData(db.vouchers).filter(v => v.date === targetDate);
                const filteredDrivers = getFilteredData(db.drivers).filter(d => d.date === targetDate);

                const tktPaid = filteredPass.reduce((s, p) => s + (p.fare || 0), 0);
                const crgPaid = filteredCargo.reduce((s, c) => s + (c.grandTotal || 0), 0);
                const trsPaid = filteredTransit.reduce((s, t) => s + (t.amount || 0), 0);
                const vRec = filteredVouchers.filter(v => v.type === 'قبض').reduce((s, v) => s + (v.amount || 0), 0);
                const vExp = filteredVouchers.filter(v => v.type === 'صرف').reduce((s, v) => s + (v.amount || 0), 0);
                const dExp = filteredDrivers.reduce((s, d) => s + (d.totalExpenses || 0), 0);

                const otherIn = trsPaid + vRec;
                const totalOut = vExp + dExp;
                const netCash = (tktPaid + crgPaid + otherIn) - totalOut;

                if (document.getElementById('dcTicketsPaid')) document.getElementById('dcTicketsPaid').innerText = `${tktPaid} AED`;
                if (document.getElementById('dcCargoPaid')) document.getElementById('dcCargoPaid').innerText = `${crgPaid} AED`;
                if (document.getElementById('dcOtherIn')) document.getElementById('dcOtherIn').innerText = `${otherIn} AED`;
                if (document.getElementById('dcTotalOut')) document.getElementById('dcTotalOut').innerText = `${totalOut} AED`;
                if (document.getElementById('dcNetCash')) document.getElementById('dcNetCash').innerText = `${netCash} AED`;
            }

            function exportDailyClosingPDF() {
                const targetDate = document.getElementById('dailyCloseDate')?.value || new Date().toISOString().split('T')[0];
                exportToPDF('dailyClosingCaptureArea', `WadiBina_DailyCashClosing_${targetDate}`);
            }

            // ================= طباعة حرارية 80mm والباركود وإشعارات الواتساب الذكية =================
            function printThermalReceipt(type) {
                const printWin = window.open('', '_blank', 'width=380,height=650');
                if (!printWin) {
                    alert('يرجى السماح بالنوافذ المنبثقة للطباعة الحرارية!');
                    return;
                }
                let bodyHtml = '';
                if (type === 'ticket' && currentPreviewTicket) {
                    const t = currentPreviewTicket;
                    bodyHtml = `
                    <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
                        <h3 style="margin:0; font-size:15px;">شركة وادي بناء للنقل الدولي</h3>
                        <p style="margin:2px 0; font-size:11px;">إيصال تذكرة سفر ركاب</p>
                        <strong style="font-size:16px;">بوليصة #${t.id}</strong>
                    </div>
                    <div style="font-size:12px; line-height:1.6;">
                        <div><strong>الراكب:</strong> ${t.name}</div>
                        <div><strong>الهاتف:</strong> ${t.phone}</div>
                        <div><strong>الجواز:</strong> ${t.passport}</div>
                        <div><strong>المسار:</strong> ${t.origin} ➔ ${t.destination}</div>
                        <div><strong>التاريخ:</strong> ${t.date}</div>
                        <div><strong>الحضور:</strong> ${t.reportingTime || '-'}</div>
                        <div style="border-top:1px dashed #000; margin-top:6px; padding-top:6px; font-size:14px;">
                            <strong>المبلغ: ${t.fare} AED</strong> (${t.payMethod})
                        </div>
                    </div>
                `;
                } else if (type === 'cargo' && currentPreviewCargo) {
                    const c = currentPreviewCargo;
                    const itemsHtml = (c.items || []).map(it => `<div>• ${it.desc} (×${it.qty}) - ${it.price} AED</div>`).join('');
                    bodyHtml = `
                    <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
                        <h3 style="margin:0; font-size:15px;">شركة وادي بناء للنقل الدولي</h3>
                        <p style="margin:2px 0; font-size:11px;">إيصال شحن أمتعة وبضائع</p>
                        <strong style="font-size:16px;">فاتورة #${c.id}</strong>
                    </div>
                    <div style="font-size:12px; line-height:1.6;">
                        <div><strong>المرسل:</strong> ${c.sender} (${c.senderPhone})</div>
                        <div><strong>المستلم:</strong> ${c.receiver} (${c.receiverPhone})</div>
                        <div><strong>العنوان:</strong> ${c.receiverAddress || '-'}</div>
                        <div style="border-top:1px dashed #000; margin:4px 0; padding-top:4px;">
                            <strong>الأصناف:</strong>
                            ${itemsHtml}
                        </div>
                        <div style="border-top:1px dashed #000; margin-top:6px; padding-top:6px; font-size:14px;">
                            <strong>الإجمالي: ${c.grandTotal} AED</strong> (${c.paymentStatus})
                        </div>
                    </div>
                `;
                }
                printWin.document.write(`
                <html dir="rtl">
                <head><title>طباعة حرارية 80mm</title>
                <style>@page { size: 80mm auto; margin: 3mm; } body { font-family: 'Cairo', Tahoma, sans-serif; width: 74mm; margin: 0 auto; color: #000; }</style>
                </head>
                <body onload="window.print(); window.close();">
                    ${bodyHtml}
                    <div style="text-align:center; font-size:10px; border-top:1px dashed #000; margin-top:8px; padding-top:6px;">
                        عجمان: 0508200749 | بني ياس: 0508200754 | عدن: 0783424999
                    </div>
                </body></html>
            `);
                printWin.document.close();
            }

            function sendTripReminderWhatsApp() {
                if (!currentPreviewTicket) return;
                const t = currentPreviewTicket;
                const targetPhone = formatPhoneForWhatsApp(t.phone);
                if (!targetPhone) { alert('رقم هاتف الراكب غير مسجل!'); return; }
                const msg = `مرحباً أ/ ${t.name}،\nنذكركم بموعد رحلتكم مع *شركة وادي بناء للنقل الدولي*:\n• رقم التذكرة: #${t.id}\n• المسار: ${t.origin} ➔ ${t.destination}\n• تاريخ الرحلة: ${t.date}\n• وقت الحضور المعتمد: ${t.reportingTime || '4:00 عصراً'}\nنتمنى لكم رحلة سعيدة وآمنة.`;
                window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            }

            function sendCargoReceiverWhatsApp() {
                if (!currentPreviewCargo) return;
                const c = currentPreviewCargo;
                const targetPhone = formatPhoneForWhatsApp(c.receiverPhone);
                if (!targetPhone) { alert('رقم هاتف المستلم غير مسجل!'); return; }
                const itemsSummary = (c.items || []).map(i => `${i.desc} (${i.qty})`).join('، ');
                const msg = `مرحباً أ/ ${c.receiver}،\nتم تسجيل شحنة باسمكم لدى *شركة وادي بناء للنقل الدولي*:\n• رقم الشحنة: #${c.id}\n• المرسل: ${c.sender}\n• المحتويات: ${itemsSummary}\n• حالة الدفع: ${c.paymentStatus} (${c.grandTotal} AED)\nسنوافيكم فور وصول الشحنة بإذن الله.`;
                window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            }

            // ================= عرض تفاصيل الرحلة (التفرع: التذاكر / فواتير الشحن + إدارة الرحلات المغادرة) =================
            let activeTripModalId = null;
            let activeTripModalMode = 'ops'; // 'ops' أو 'finance'

            function openTripDetailsModal(tripId, mode = 'ops') {
                const trip = (db.trips || []).find(t => String(t.id) === String(tripId));
                if (!trip) return;

                if (trip.status === 'غادرت الرحلة' && mode !== 'finance') {
                    alert('هذه الرحلة غادرت! تم نقل عرض وإضافة تذاكرها وفواتيرها إلى قسم الإدارة المالية للمدير العام والمحاسب فقط.');
                    return;
                }

                if (mode === 'finance' && !canModifyFinancialsOrAccounts()) {
                    alert('عذراً، هذا العرض مخصص للإدارة المالية (المدير العام / المحاسب / محمود) فقط!');
                    return;
                }

                activeTripModalId = trip.id;
                activeTripModalMode = mode;

                document.getElementById('tripDetailsModalTitle').innerText = mode === 'finance'
                    ? `إدارة حسابات وتذاكر وفواتير الرحلة المغادرة (${trip.route})`
                    : `تفاصيل وحجوزات الرحلة (${trip.route})`;
                document.getElementById('tripDetailsModalSub').innerText = `التاريخ: ${trip.date || '-'} | الباص والسائق: ${trip.busInfo || '-'} | الحالة: ${trip.status || 'مجدولة'}`;

                // إظهار أزرار إضافة تذكرة/فاتورة لرحلة غادرت حصرياً في الإدارة المالية
                const financeAddBar = document.getElementById('departedTripFinanceAddBar');
                if (financeAddBar) {
                    if (mode === 'finance' && trip.status === 'غادرت الرحلة' && canModifyFinancialsOrAccounts()) {
                        financeAddBar.classList.remove('hidden');
                    } else {
                        financeAddBar.classList.add('hidden');
                    }
                }

                const tripTickets = (db.passengers || []).filter(p => String(p.tripId) === String(trip.id));
                const tripCargo = (db.cargo || []).filter(c => String(c.tripId) === String(trip.id));

                document.getElementById('tripBranchTktCount').innerText = tripTickets.length;
                document.getElementById('tripBranchCargoCount').innerText = tripCargo.length;

                // ملخص مالي في وضع الإدارة المالية
                const finBar = document.getElementById('tripFinancialSummaryBar');
                if (mode === 'finance') {
                    finBar.classList.remove('hidden');
                    const tktSum = tripTickets.reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
                    const cargoSum = tripCargo.reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
                    const paidTkt = tripTickets.filter(p => p.payMethod === 'مدفوع').reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
                    const paidCargo = tripCargo.filter(c => c.paymentStatus === 'مدفوع').reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
                    document.getElementById('tripFinTktTotal').innerText = `${tktSum} AED (مدفوع: ${paidTkt})`;
                    document.getElementById('tripFinCargoTotal').innerText = `${cargoSum} AED (مدفوع: ${paidCargo})`;
                    document.getElementById('tripFinGrandTotal').innerText = `${paidTkt + paidCargo} AED / ${tktSum + cargoSum} AED`;
                } else {
                    finBar.classList.add('hidden');
                }

                renderTripBranchTables(tripTickets, tripCargo, mode);
                switchTripDetailsBranch('tickets');
                document.getElementById('tripDetailsModal').classList.remove('hidden');
            }

            function openAddTicketForDepartedTrip() {
                if (!activeTripModalId || !canModifyFinancialsOrAccounts()) return;
                const targetTripId = activeTripModalId;
                closeModal('tripDetailsModal');
                financeOverrideDepartedTripId = targetTripId;
                switchTab('passengers');
                resetPassengerForm();
                populateTripsDropdown();
                const sel = document.getElementById('passTripSelect');
                if (sel) {
                    sel.value = targetTripId;
                    onTripSelectedForTicket();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function openAddCargoForDepartedTrip() {
                if (!activeTripModalId || !canModifyFinancialsOrAccounts()) return;
                const targetTripId = activeTripModalId;
                closeModal('tripDetailsModal');
                financeOverrideDepartedTripId = targetTripId;
                switchTab('cargo');
                resetCargoForm();
                populateTripsDropdown();
                const sel = document.getElementById('cargoTripSelect');
                if (sel) {
                    sel.value = targetTripId;
                    onTripSelectedForCargo();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            function switchTripDetailsBranch(branch) {
                const btnTkt = document.getElementById('btnTripSubTickets');
                const btnCrg = document.getElementById('btnTripSubCargo');
                const boxTkt = document.getElementById('tripBranchTicketsContainer');
                const boxCrg = document.getElementById('tripBranchCargoContainer');

                if (branch === 'tickets') {
                    btnTkt.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition gold-gradient-bg text-black shadow";
                    btnCrg.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition bg-zinc-800 text-zinc-300 hover:text-gold border border-zinc-700";
                    boxTkt.classList.remove('hidden');
                    boxCrg.classList.add('hidden');
                } else {
                    btnCrg.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition gold-gradient-bg text-black shadow";
                    btnTkt.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition bg-zinc-800 text-zinc-300 hover:text-gold border border-zinc-700";
                    boxCrg.classList.remove('hidden');
                    boxTkt.classList.add('hidden');
                }
            }

            function renderTripBranchTables(tripTickets, tripCargo, mode) {
                const tktHead = document.getElementById('tripBranchTicketsHead');
                const tktBody = document.getElementById('tripBranchTicketsBody');
                const crgHead = document.getElementById('tripBranchCargoHead');
                const crgBody = document.getElementById('tripBranchCargoBody');

                const isFin = mode === 'finance';

                tktHead.innerHTML = `
                <tr>
                    <th>رقم التذكرة</th>
                    <th>الراكب الرئيسي</th>
                    <th>الهاتف</th>
                    <th>الجواز</th>
                    <th>المرافقون</th>
                    <th>المسار</th>
                    <th>المبلغ</th>
                    <th>حالة السداد</th>
                    <th>إجراءات</th>
                </tr>
            `;
                tktBody.innerHTML = '';
                if (tripTickets.length === 0) {
                    tktBody.innerHTML = `<tr><td colspan="9" class="text-center text-zinc-500 py-4">لا توجد تذاكر مسجلة لهذه الرحلة</td></tr>`;
                } else {
                    tripTickets.forEach(p => {
                        const extraText = (p.extraPassengers && p.extraPassengers.length > 0)
                            ? p.extraPassengers.map((ex, i) => `#${ex.ticketNo || (p.id + '-' + (i + 1))} ${ex.name}`).join('، ')
                            : '-';
                        const payCell = isFin
                            ? `<select onchange="updateTripTicketPaymentFromFinance('${p.id}', this.value)" class="bg-zinc-900 border border-gold text-gold rounded px-2 py-1 text-xs font-bold">
                                <option value="مدفوع" ${p.payMethod === 'مدفوع' ? 'selected' : ''}>مدفوع</option>
                                <option value="الدفع عند الباص" ${p.payMethod === 'الدفع عند الباص' ? 'selected' : ''}>الدفع عند الباص</option>
                                <option value="مؤجل باليمن" ${p.payMethod === 'مؤجل باليمن' ? 'selected' : ''}>مؤجل باليمن</option>
                           </select>`
                            : `<span class="bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-xs font-bold">${p.payMethod}</span>`;

                        tktBody.insertRow().innerHTML = `
                        <td><strong class="text-gold">#${p.id}</strong></td>
                        <td><strong>${p.name}</strong></td>
                        <td>${p.phone}</td>
                        <td class="font-mono text-xs">${p.passport}</td>
                        <td class="text-xs text-amber-300">${extraText}</td>
                        <td>${p.origin} ➔ ${p.destination}</td>
                        <td class="font-bold text-emerald-400">${p.fare} AED</td>
                        <td>${payCell}</td>
                        <td class="space-x-1 space-x-reverse">
                            <button onclick="previewTicketImage('${p.id}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-pdf"></i></button>
                            ${isFin ? `<button onclick="closeModal('tripDetailsModal'); switchTab('passengers'); editPassenger('${p.id}');" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>` : ''}
                        </td>
                    `;
                    });
                }

                crgHead.innerHTML = `
                <tr>
                    <th>رقم الفاتورة</th>
                    <th>المرسل</th>
                    <th>المستلم</th>
                    <th>الأصناف</th>
                    <th>المبلغ</th>
                    <th>حالة السداد</th>
                    <th>إجراءات</th>
                </tr>
            `;
                crgBody.innerHTML = '';
                if (tripCargo.length === 0) {
                    crgBody.innerHTML = `<tr><td colspan="7" class="text-center text-zinc-500 py-4">لا توجد فواتير شحن مرتبطة بهذه الرحلة</td></tr>`;
                } else {
                    tripCargo.forEach(c => {
                        const itemsDesc = (c.items || []).map(i => `${i.desc} (${i.qty})`).join(' + ');
                        const payCell = isFin
                            ? `<select onchange="updateTripCargoPaymentFromFinance('${c.id}', this.value)" class="bg-zinc-900 border border-gold text-gold rounded px-2 py-1 text-xs font-bold">
                                <option value="مدفوع" ${c.paymentStatus === 'مدفوع' ? 'selected' : ''}>مدفوع</option>
                                <option value="أجل بالامارات" ${c.paymentStatus === 'أجل بالامارات' ? 'selected' : ''}>أجل بالامارات</option>
                                <option value="الدفع باليمن" ${c.paymentStatus === 'الدفع باليمن' ? 'selected' : ''}>الدفع باليمن</option>
                                <option value="مؤجل باليمن" ${c.paymentStatus === 'مؤجل باليمن' ? 'selected' : ''}>مؤجل باليمن</option>
                           </select>`
                            : `<span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">${c.paymentStatus}</span>`;

                        crgBody.insertRow().innerHTML = `
                        <td><strong class="text-gold">#${c.id}</strong></td>
                        <td><strong>${c.sender}</strong></td>
                        <td>${c.receiver} (${c.receiverAddress || '-'})</td>
                        <td class="text-xs">${itemsDesc}</td>
                        <td class="font-bold text-emerald-400">${c.grandTotal} AED</td>
                        <td>${payCell}</td>
                        <td class="space-x-1 space-x-reverse">
                            <button onclick="previewCargoImage('${c.id}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-pdf"></i></button>
                            ${isFin ? `<button onclick="closeModal('tripDetailsModal'); switchTab('cargo'); editCargo('${c.id}');" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>` : ''}
                        </td>
                    `;
                    });
                }
            }

            function updateTripTicketPaymentFromFinance(ticketId, newPayMethod) {
                if (!canModifyFinancialsOrAccounts()) {
                    alert('عذراً، تعديل السداد متاح للإدارة المالية والمدير العام والمحاسب فقط!');
                    return;
                }
                const idx = (db.passengers || []).findIndex(p => String(p.id) === String(ticketId));
                if (idx === -1) return;
                db.passengers[idx].payMethod = newPayMethod;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                if (!db.passengers[idx].auditLog) db.passengers[idx].auditLog = [];
                db.passengers[idx].auditLog.push({ action: `تحديث سداد التذكرة من الإدارة المالية إلى: ${newPayMethod}`, user: author, time: nowStr });
                saveDB();
                refreshUI();
                if (activeTripModalId) openTripDetailsModal(activeTripModalId, 'finance');
            }

            function updateTripCargoPaymentFromFinance(cargoId, newPayStatus) {
                if (!canModifyFinancialsOrAccounts()) {
                    alert('عذراً، تعديل السداد متاح للإدارة المالية والمدير العام والمحاسب فقط!');
                    return;
                }
                const idx = (db.cargo || []).findIndex(c => String(c.id) === String(cargoId));
                if (idx === -1) return;
                db.cargo[idx].paymentStatus = newPayStatus;
                const nowStr = getFormattedDateTime();
                const author = getCurrentUserName();
                if (!db.cargo[idx].auditLog) db.cargo[idx].auditLog = [];
                db.cargo[idx].auditLog.push({ action: `تحديث سداد الفاتورة من الإدارة المالية إلى: ${newPayStatus}`, user: author, time: nowStr });
                saveDB();
                refreshUI();
                if (activeTripModalId) {
                    openTripDetailsModal(activeTripModalId, 'finance');
                    switchTripDetailsBranch('cargo');
                }
            }

            function renderDepartedTripsFinanceTable() {
                const tbody = document.querySelector('#finDepartedTripsTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';

                const departedTrips = (db.trips || []).filter(t => t.status === 'غادرت الرحلة');
                departedTrips.sort((a, b) => b.id.localeCompare(a.id));

                if (departedTrips.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-zinc-500 py-4">لا توجد رحلات بحالة "غادرت الرحلة" حالياً.</td></tr>`;
                    return;
                }

                departedTrips.forEach((trip, idx) => {
                    const tripTickets = (db.passengers || []).filter(p => String(p.tripId) === String(trip.id));
                    const tripCargo = (db.cargo || []).filter(c => String(c.tripId) === String(trip.id));

                    const tktTotal = tripTickets.reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
                    const cargoTotal = tripCargo.reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
                    const grossTotal = tktTotal + cargoTotal;

                    const tktPaid = tripTickets.filter(p => p.payMethod === 'مدفوع').reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
                    const cargoPaid = tripCargo.filter(c => c.paymentStatus === 'مدفوع').reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
                    const paidTotal = tktPaid + cargoPaid;
                    const unpaidTotal = grossTotal - paidTotal;

                    // ربط مصروفات السائق بتطابق تاريخ الرحلة
                    const matchedDrivers = (db.drivers || []).filter(d => trip.date && trip.date !== '-' && d.date === trip.date);
                    const drvExp = matchedDrivers.reduce((s, d) => s + (parseFloat(d.totalExpenses) || 0), 0);
                    const netTripProfit = paidTotal - drvExp;

                    tbody.insertRow().innerHTML = `
                    <td><strong>#${departedTrips.length - idx}</strong></td>
                    <td><strong class="text-gold">${trip.date}</strong></td>
                    <td>${trip.route}</td>
                    <td>${trip.busInfo}</td>
                    <td><span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold">${tripTickets.length}</span></td>
                    <td><span class="bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full text-xs font-bold">${tripCargo.length}</span></td>
                    <td class="font-bold text-zinc-200">${grossTotal} AED</td>
                    <td class="font-bold text-emerald-400">${paidTotal} AED</td>
                    <td class="font-bold text-amber-400">${unpaidTotal} AED</td>
                    <td class="font-bold text-red-400">${drvExp} AED</td>
                    <td class="font-black ${netTripProfit >= 0 ? 'text-emerald-300' : 'text-red-400'}">${netTripProfit} AED</td>
                    <td>
                        <button onclick="openTripDetailsModal('${trip.id}', 'finance')" class="gold-gradient-bg text-black px-3 py-1 rounded text-xs font-extrabold shadow">
                            <i class="fa-solid fa-file-invoice-dollar ml-1"></i> عرض التذاكر والفواتير والحسابات
                        </button>
                    </td>
                `;
                });
            }

            // ================= إدارة المستخدمين =================
            function handleSaveUser(e) {
                e.preventDefault();
                if (!canModifyFinancialsOrAccounts()) { alert('عذراً، إدارة المستخدمين مخصصة للإدارة العليا والمحاسبة فقط!'); return; }
                const origName = document.getElementById('userEditOriginalName').value;
                const username = document.getElementById('manageUsername').value.trim();
                const password = document.getElementById('managePassword').value.trim();
                const role = document.getElementById('manageRole').value;
                const branch = document.getElementById('manageBranch').value;

                if (role === 'مالك' && currentUser.role !== 'مالك') {
                    alert('لا يمكن منح صلاحية المالك إلا لحساب مالك موجود.');
                    return;
                }

                let users = [...cloudUsers];

                if (origName) {
                    const idx = users.findIndex(u => u.username === origName);
                    if (idx !== -1) {
                        const active = users[idx].active !== false;
                        const previous = { ...users[idx] };
                        users[idx] = { ...users[idx], username, password, role, branch, active };
                        writeUserAuditLog('UPDATE_PERMISSIONS', username, {
                            from: { username: origName, role: previous.role, branch: previous.branch },
                            to: { username, role, branch }
                        });
                    }
                    alert('تم تحديث بيانات المستخدم وصلاحياته بنجاح!');
                } else {
                    if (users.some(u => u.username === username)) { alert('اسم المستخدم موجود بالفعل!'); return; }
                    users.push({ username, password, role, branch, fullName: username, active: true, hidden: role === 'مالك' });
                    writeUserAuditLog('CREATE_USER', username, { role, branch, active: true });
                    alert('تم إضافة المستخدم الجديد بنجاح!');
                }

                saveCloudUsers(users);
                resetUserForm();
                renderUsersTable();
            }

            function editUser(username) {
                if (!canModifyFinancialsOrAccounts()) return;
                let users = [...cloudUsers];
                const u = users.find(x => x.username === username);
                if (!u) return;
                document.getElementById('userEditOriginalName').value = u.username;
                document.getElementById('manageUsername').value = u.username;
                document.getElementById('managePassword').value = u.password;
                document.getElementById('manageRole').value = u.role || 'موظف';
                document.getElementById('manageBranch').value = u.branch || 'فرع عجمان';
                document.getElementById('userSubmitBtn').innerText = 'حفظ التعديلات';
            }

            function deleteUser(username) {
                if (!canModifyFinancialsOrAccounts()) return;
                if (username === currentUser.username) { alert('لا يمكنك حذف حسابك النشط حالياً!'); return; }
                if (username === 'محمود') { alert('لا يمكن حذف الحساب الرئيسي للمدير العام محمود!'); return; }
                let users = [...cloudUsers];
                const target = users.find(u => u.username === username);
                if (target?.role === 'مالك' && currentUser.role !== 'مالك') {
                    alert('لا يمكن حذف حساب المالك.');
                    return;
                }
                users = users.filter(u => u.username !== username);
                saveCloudUsers(users);
                writeUserAuditLog('DELETE_USER', username, { role: target?.role || null });
                renderUsersTable();
            }

            function toggleUserActive(username) {
                if (!canModifyFinancialsOrAccounts()) return;
                if (username === currentUser.username) { alert('لا يمكنك إيقاف حسابك النشط حالياً!'); return; }
                let users = [...cloudUsers];
                const target = users.find(u => u.username === username);
                if (!target) return;
                if (target.role === 'مالك' && currentUser.role !== 'مالك') {
                    alert('لا يمكن تغيير حالة حساب المالك.');
                    return;
                }
                target.active = target.active === false;
                saveCloudUsers(users);
                writeUserAuditLog(target.active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', username, { active: target.active });
                renderUsersTable();
            }

            function resetUserForm() {
                document.getElementById('userForm').reset();
                document.getElementById('userEditOriginalName').value = '';
                document.getElementById('userSubmitBtn').innerText = 'إضافة مستخدم جديد';
            }

            function renderUsersTable() {
                const tbody = document.querySelector('#usersTable tbody');
                if (!tbody) return;
                tbody.innerHTML = '';
                let users = [...cloudUsers];
                users.forEach(u => {
                    if (u.role === 'مالك' && u.hidden && currentUser.role !== 'مالك') return;
                    const protectedOwner = u.role === 'مالك';
                    const canEditTarget = !protectedOwner || currentUser.role === 'مالك';
                    tbody.insertRow().innerHTML = `
                    <td><strong>${u.username}</strong></td>
                    <td><span class="bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded font-mono text-xs text-amber-400">${u.password}</span></td>
                    <td><span class="bg-amber-950 text-gold px-2 py-0.5 rounded text-xs font-bold">${u.role}</span></td>
                    <td><span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">${u.branch || 'فرع عجمان'}</span></td>
                    <td><span class="${u.active === false ? 'text-red-400' : 'text-emerald-400'} font-bold">${u.active === false ? 'موقوف' : 'نشط'}</span></td>
                    <td class="space-x-1 space-x-reverse">
                        ${canEditTarget ? `
                        <button onclick="editUser('${u.username}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i> تعديل</button>
                        <button onclick="toggleUserActive('${u.username}')" class="bg-zinc-700 text-zinc-100 px-2 py-1 rounded text-xs font-bold">${u.active === false ? 'تفعيل' : 'إيقاف'}</button>
                        <button onclick="deleteUser('${u.username}')" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i> حذف</button>` : '<span class="text-zinc-500 text-xs">محمي</span>'}
                    </td>
                `;
                });
            }

            // ================= البحث الذكي والترتيب التنازلي وإخفاء تذاكر وفواتير الرحلات المغادرة من الأقسام العادية =================
            function handleGlobalSearch() {
                const query = document.getElementById('globalSearchInput').value.toLowerCase().trim();
                const type = document.getElementById('globalSearchType').value;
                const advPay = document.getElementById('advFilterPayment')?.value || 'all';
                const advOrig = document.getElementById('advFilterOrigin')?.value || 'all';
                const advDest = document.getElementById('advFilterDestination')?.value || 'all';
                const canDeleteAll = isMahmoudOrGeneralManager();

                // إخفاء التذاكر والفواتير المرتبطة برحلات حالتها "غادرت الرحلة" من القوائم العادية (تُعرض فقط داخل الإدارة المالية)
                const departedTripIds = new Set(
                    (db.trips || [])
                        .filter(t => t.status === 'غادرت الرحلة')
                        .map(t => String(t.id))
                );

                // التذاكر
                const pBody = document.querySelector('#passengersTable tbody');
                pBody.innerHTML = '';
                let pList = getFilteredData(db.passengers).filter(p => !(p.tripId && departedTripIds.has(String(p.tripId))));

                if (advPay !== 'all') pList = pList.filter(p => p.payMethod === advPay);
                if (advOrig !== 'all') pList = pList.filter(p => p.origin === advOrig);
                if (advDest !== 'all') pList = pList.filter(p => p.destination === advDest);

                if (query && (type === 'all' || type === 'ticket')) {
                    pList = pList.filter(p => p.id.toLowerCase().includes(query) || p.name.toLowerCase().includes(query) || p.phone.includes(query) || p.passport.toLowerCase().includes(query) || (p.agent && p.agent.toLowerCase().includes(query)) || (p.notes && p.notes.toLowerCase().includes(query)) || (p.extraPassengers && p.extraPassengers.some(ex => ex.name.toLowerCase().includes(query) || (ex.ticketNo && String(ex.ticketNo).toLowerCase().includes(query)))));
                }
                pList.sort(compareInvoiceIdsDesc);
                let totalTktRev = 0;
                pList.forEach((p) => {
                    totalTktRev += (p.fare || 0);
                    const realIdx = db.passengers.findIndex(x => String(x.id) === String(p.id));
                    const extraNames = (p.extraPassengers && p.extraPassengers.length > 0) ? p.extraPassengers.map((x, i) => `#${x.ticketNo || (p.id + '-' + (i + 1))} ${x.name}`).join('، ') : '-';
                    pBody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${p.id}</strong></td>
                    <td><span class="text-zinc-300 font-bold">${p.agent || 'أبو خالد'}</span></td>
                    <td><strong>${p.name}</strong> <span class="text-[10px] text-zinc-400">(${p.passengerCount})</span></td>
                    <td class="text-xs text-amber-300">${extraNames}</td>
                    <td>${p.phone}</td>
                    <td>${p.origin} ➔ ${p.destination}</td>
                    <td><strong class="text-gold">${p.date}</strong></td>
                    <td><strong>${p.fare} AED</strong></td>
                    <td class="text-xs text-zinc-300 max-w-[160px] truncate" title="${p.notes || ''}">${p.notes || '-'}</td>
                    <td><span class="bg-amber-950 text-amber-300 px-2 py-0.5 rounded text-xs font-bold">${p.payMethod}</span></td>
                    <td><span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">${p.branch || 'فرع عجمان'}</span></td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="previewTicketImage('${p.id}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                        <button onclick="editPassenger('${p.id}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        ${canDeleteAll ? `<button onclick="deleteRecord('passengers', ${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                `;
                });
                document.getElementById('statTicketCount').innerText = pList.length;
                document.getElementById('statTicketRevenue').innerText = `${totalTktRev} AED`;

                // الشحن
                const cBody = document.querySelector('#cargoTable tbody');
                cBody.innerHTML = '';
                let cList = getFilteredData(db.cargo).filter(c => !(c.tripId && departedTripIds.has(String(c.tripId))));
                if (advPay !== 'all') cList = cList.filter(c => c.paymentStatus === advPay);

                if (query && (type === 'all' || type === 'cargo')) {
                    cList = cList.filter(c => c.id.toLowerCase().includes(query) || c.sender.toLowerCase().includes(query) || c.receiver.toLowerCase().includes(query) || (c.notes && c.notes.toLowerCase().includes(query)) || c.items.some(i => i.desc.toLowerCase().includes(query)));
                }
                cList.sort(compareInvoiceIdsDesc);
                cList.forEach((c) => {
                    const realIdx = db.cargo.findIndex(x => String(x.id) === String(c.id));
                    const tripObj = (db.trips || []).find(t => String(t.id) === String(c.tripId));
                    const tripBadge = tripObj ? `<span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-xs">${tripObj.date !== '-' ? tripObj.date : ''} (${tripObj.route})</span>` : '<span class="text-zinc-500 text-xs">-</span>';
                    cBody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${c.id}</strong></td>
                    <td>${c.date}</td>
                    <td>${c.sender}</td>
                    <td>${c.receiver} <span class="text-zinc-500 text-[10px]">(${c.receiverAddress || '-'})</span></td>
                    <td>${tripBadge}</td>
                    <td><span class="bg-zinc-800 px-2 py-0.5 rounded text-xs text-gold">${c.items.length}</span></td>
                    <td class="text-emerald-400 font-bold">${c.grandTotal} AED</td>
                    <td class="text-xs text-zinc-300 max-w-[160px] truncate" title="${c.notes || ''}">${c.notes || '-'}</td>
                    <td><span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-xs">${c.paymentStatus}</span></td>
                    <td><span class="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">${c.branch || 'فرع عجمان'}</span></td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="previewCargoImage('${c.id}')" class="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                        ${Array.isArray(c.photos) && c.photos.length ? `<button onclick="viewCargoPhotos('${c.id}')" class="bg-sky-700 text-white px-2 py-1 rounded text-xs font-bold" title="عرض الصور المرفقة"><i class="fa-solid fa-images"></i> صور (${c.photos.length})</button>` : ''}
                        <button onclick="editCargo('${c.id}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        ${canDeleteAll ? `<button onclick="deleteRecord('cargo', ${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                `;
                });
            }

            function resetGlobalSearch() {
                document.getElementById('globalSearchInput').value = '';
                document.getElementById('globalSearchType').value = 'all';
                if (document.getElementById('advFilterPayment')) document.getElementById('advFilterPayment').value = 'all';
                if (document.getElementById('advFilterOrigin')) document.getElementById('advFilterOrigin').value = 'all';
                if (document.getElementById('advFilterDestination')) document.getElementById('advFilterDestination').value = 'all';
                handleGlobalSearch();
            }

            function deleteRecord(col, idx) {
                if ((col === 'passengers' || col === 'cargo') && !isMahmoudOrGeneralManager()) {
                    alert('عذراً، حذف التذاكر وفواتير الشحن مسموح فقط للمستخدم محمود وللمدير العام!');
                    return;
                }
                if ((col === 'vouchers' || col === 'debtInvoices') && !canModifyFinancialsOrAccounts()) {
                    alert('عذراً، حذف السندات والفواتير الآجلة مسموح فقط للإدارة المالية!');
                    return;
                }
                db[col].splice(idx, 1);
                saveDB();
                refreshUI();
            }

            function exportExcel(type) {
                const list = getFilteredData(db[type]);
                const ws = XLSX.utils.json_to_sheet(list);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, type);
                XLSX.writeFile(wb, `WadiBina_${type}_${Date.now()}.xlsx`);
            }

            function exportBackupJSON() {
                const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `WadiBina_Backup_${Date.now()}.json`; a.click();
            }

            function importBackupJSON(e) {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، استرجاع النسخ الاحتياطية مخصص لمحمود والمدير العام فقط!');
                    return;
                }
                const reader = new FileReader();
                reader.onload = ev => {
                    db = JSON.parse(ev.target.result);
                    validateAndRepairDB();
                    saveDB(true);
                    refreshUI();
                    alert('تم استرجاع النسخة الاحتياطية بنجاح ومزامنتها!');
                };
                reader.readAsText(e.target.files[0]);
            }

            // ================= تصدير واستعادة PDF مدمجة =================
            function exportSystemBackupPDF() {
                const reportEl = document.getElementById('systemReportPrintArea');
                if (!reportEl) return;

                document.getElementById('reportDateBadge').innerText = new Date().toLocaleDateString('ar-AE');
                document.getElementById('reportUserBadge').innerText = currentUser ? currentUser.username : 'المدير العام';
                document.getElementById('repTotalTkt').innerText = db.passengers.length;
                document.getElementById('repTotalCargo').innerText = db.cargo.length;
                document.getElementById('repTotalDebt').innerText = db.debtInvoices.length;

                const tBody = document.getElementById('repTicketsTbody');
                tBody.innerHTML = '';
                db.passengers.slice(0, 15).forEach(p => {
                    tBody.insertRow().innerHTML = `
                    <td class="border border-slate-300 p-2 font-bold">#${p.id}</td>
                    <td class="border border-slate-300 p-2">${p.name}</td>
                    <td class="border border-slate-300 p-2">${p.phone}</td>
                    <td class="border border-slate-300 p-2">${p.origin} ➔ ${p.destination}</td>
                    <td class="border border-slate-300 p-2 font-bold">${p.fare} AED</td>
                    <td class="border border-slate-300 p-2">${p.payMethod}</td>
                `;
                });

                reportEl.classList.remove('hidden');

                html2canvas(reportEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                    reportEl.classList.add('hidden');
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    const margin = 8;
                    const imgWidth = pdfWidth - margin * 2;
                    const pageHeight = pdfHeight - margin * 2;
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    let heightLeft = imgHeight;
                    let position = margin;

                    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;

                    while (heightLeft > 0) {
                        position = margin - (imgHeight - heightLeft);
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
                        heightLeft -= pageHeight;
                    }

                    const jsonStr = JSON.stringify(db);
                    const encodedPayload = btoa(unescape(encodeURIComponent(jsonStr)));
                    pdf.setProperties({
                        title: 'WadiBina_System_Backup',
                        subject: 'WADI_BINA_BACKUP_V1:' + encodedPayload,
                        creator: 'Wadi Bina Transport System'
                    });

                    pdf.save(`WadiBina_System_Backup_${Date.now()}.pdf`);
                    alert('تم إنشاء وحفظ ملف النسخة الاحتياطية PDF بنجاح!\nيمكنك استعادة جميع بيانات النظام منه في أي وقت عبر زر (استعادة من PDF).');
                });
            }

            async function importBackupPDF(e) {
                if (!isMahmoudOrGeneralManager()) {
                    alert('عذراً، استعادة النسخة الاحتياطية مخصصة لمحمود والمدير العام فقط!');
                    return;
                }
                const file = e.target.files[0];
                if (!file) return;

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const metadata = await pdfDoc.getMetadata();

                    if (metadata && metadata.info && metadata.info.Subject && metadata.info.Subject.startsWith('WADI_BINA_BACKUP_V1:')) {
                        const encoded = metadata.info.Subject.replace('WADI_BINA_BACKUP_V1:', '');
                        const jsonStr = decodeURIComponent(escape(atob(encoded)));
                        const parsedDB = JSON.parse(jsonStr);

                        if (parsedDB && parsedDB.passengers) {
                            db = parsedDB;
                            validateAndRepairDB();
                            saveDB(true);
                            refreshUI();
                            alert('تمت استعادة كافة البيانات والتذاكر وفواتير الشحن والحسابات من ملف PDF بنجاح ومزامنتها!');
                        } else {
                            alert('ملف الـ PDF تالف ولا يحتوي على بنية بيانات صالحة.');
                        }
                    } else {
                        alert('عذراً! هذا الملف ليس نسخة احتياطية صادرة من النظام الموحد لشركة وادي بناء.');
                    }
                } catch (err) {
                    console.error('PDF Restore Error:', err);
                    alert('حدث خطأ أثناء قراءة ملف PDF. تأكد من اختيار ملف النسخة الاحتياطية الصحيح.');
                }
                e.target.value = '';
            }

            function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

            Object.assign(window, {
                handleLogin, handleLogout, switchTab, switchFinancialSubTab, toggleLanguage,
                openChangePasswordModal, handleUserChangePassword,
                handleSaveTrip, editTrip, markTripDeparted, resetTripForm, deleteTrip, onTripSelectedForTicket, onTripSelectedForCargo, openManifestForTrip,
                onBusColorSelectChange, handleSaveBus, editBus, resetBusForm, deleteBus, quickLinkBusToTrip, onBusSelectedForTrip,
                openTripDetailsModal, switchTripDetailsBranch, updateTripTicketPaymentFromFinance, updateTripCargoPaymentFromFinance, openAddTicketForDepartedTrip, openAddCargoForDepartedTrip,
                handleSaveDriverAccount, editDriverAccount, resetDriverForm, deleteDriverAccount, previewDriverAccount, calculateDriverNet,
                onEmpRoleTypeChange, handleSaveEmployee, editEmployee, resetEmployeeForm, deleteEmployee, handleSaveAdvance, handleCashReceiptForEmployee,
                handleSavePassenger, editPassenger, resetPassengerForm, onPassengerCountChanged, updateReportingTimeAutomatically,
                handleSaveCargo, editCargo, resetCargoForm, addCargoItemRow, calculateCargoTotal,
                handleCargoImagesSelect, removeCargoAttachment, renderCargoFormImagesPreview, viewCargoPhotos,
                toggleManualTransitForm, handleTransitDragOver, handleTransitDragLeave, handleTransitDrop, handleTransitPdfFiles,
                loadSampleTransitVisas, updateTransitInlineField, viewTransitRawText, copySingleTransitRow,
                copyTransitTableToClipboard, exportTransitCSV, printTransitTableOnly, clearAllTransitRecords, renderTransitTable,
                onTransitIdentityChange, handleSaveTransit, updateTransitPaymentStatus, editTransitVisa, resetTransitForm, exportTransitExcel,
                handleSaveVoucher, handleSaveDebtInvoice,
                handleSaveUser, editUser, deleteUser, toggleUserActive, resetUserForm,
                previewTicketImage, previewCargoImage, previewDebtInvoice, openManifestModal, openCargoManifestModal,
                renderPassengerManifestTable, renderCargoManifestTable, printManifestPassenger, printManifestCargo,
                printDocumentA5, printDocumentLandscape,
                downloadCapturedImage, exportToPDF, exportMultiPagePDF, closeModal, handleGlobalSearch, resetGlobalSearch,
                deleteRecord, exportExcel, exportBackupJSON, importBackupJSON, exportSystemBackupPDF, importBackupPDF,
                sendTicketViaWhatsApp, sendCargoViaWhatsApp, downloadTicketImageWithWhatsAppPrompt, downloadCargoImageWithWhatsAppPrompt,
                toggleDeviceLayoutMode, toggleSidebar, refreshUI, renderDailyCashClosingReport, exportDailyClosingPDF,
                printThermalReceipt, sendTripReminderWhatsApp, sendCargoReceiverWhatsApp,
                getTicketFileName, getCargoFileName, getDebtFileName
            });
