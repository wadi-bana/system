// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCX0AnjNnffeRCFGDugKeOI8k8adJC1aqs",
  authDomain: "wadi-bana-b585b.firebaseapp.com",
  databaseURL: "https://wadi-bana-b585b-default-rtdb.firebaseio.com",
  projectId: "wadi-bana-b585b",
  storageBucket: "wadi-bana-b585b.firebasestorage.app",
  messagingSenderId: "57806694102",
  appId: "1:57806694102:web:8b2f38f1b86c0240290b77",
  measurementId: "G-DR3Y513XP9"
};

window.firebaseConfig = Object.assign({}, window.firebaseConfig || {}, firebaseConfig);

(function () {
    let activeTripDetailsId = null;
    let activeTripDetailsMode = 'ops';
    let cloudUsersCache = [];
    let cloudDbInitialized = false;

    const DEFAULT_USERS = [
        { username: "محمود", password: "123", role: "مدير عام", branch: "جميع الفروع" }
    ];

    function getCloudDBRef() {
        if (typeof firebase === 'undefined' || !firebase.apps) return null;
        if (!firebase.apps.length && window.firebaseConfig) {
            firebase.initializeApp(window.firebaseConfig);
        }
        try {
            return firebase.database().ref('wadi_bina_system');
        } catch (err) {
            console.error('Firebase DB error:', err);
            return null;
        }
    }

    function getDB() {
        if (!window.db) {
            window.db = {
                passengers: [],
                cargo: [],
                trips: [],
                buses: [],
                drivers: [],
                employees: [],
                vouchers: [],
                debtInvoices: [],
                transitVisas: []
            };
        }
        return window.db;
    }

    function escapeHTML(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // مزامنة سحابية مباشرة دون استخدام localStorage
    function syncCloudToLocalMemory(snapshotVal) {
        const db = getDB();
        const data = snapshotVal && typeof snapshotVal === 'object' ? snapshotVal : {};

        db.passengers = Array.isArray(data.passengers) ? data.passengers : [];
        db.cargo = Array.isArray(data.cargo) ? data.cargo : [];
        db.trips = Array.isArray(data.trips) ? data.trips : [];
        db.buses = Array.isArray(data.buses) ? data.buses : [];
        db.drivers = Array.isArray(data.drivers) ? data.drivers : [];
        db.employees = Array.isArray(data.employees) ? data.employees : [];
        db.vouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
        db.debtInvoices = Array.isArray(data.debtInvoices) ? data.debtInvoices : [];
        db.transitVisas = Array.isArray(data.transitVisas) ? data.transitVisas : [];

        if (Array.isArray(data.users) && data.users.length > 0) {
            cloudUsersCache = data.users;
        } else if (!cloudDbInitialized) {
            cloudUsersCache = DEFAULT_USERS.slice();
            const rootRef = getCloudDBRef();
            if (rootRef) {
                rootRef.child('users').set(cloudUsersCache).catch(() => {});
            }
        }

        cloudDbInitialized = true;
        if (typeof window.refreshUI === 'function') {
            window.refreshUI();
        }
    }

    function pushFullStateToCloud() {
        const rootRef = getCloudDBRef();
        const db = getDB();
        if (!rootRef) {
            alert('تعذر الاتصال بقاعدة البيانات السحابية Firebase.');
            return Promise.reject(new Error('No Firebase connection'));
        }

        const payload = {
            passengers: db.passengers || [],
            cargo: db.cargo || [],
            trips: db.trips || [],
            buses: db.buses || [],
            drivers: db.drivers || [],
            employees: db.employees || [],
            vouchers: db.vouchers || [],
            debtInvoices: db.debtInvoices || [],
            transitVisas: db.transitVisas || [],
            users: cloudUsersCache.length ? cloudUsersCache : DEFAULT_USERS.slice(),
            updatedAt: new Date().toISOString()
        };

        return rootRef.set(payload).catch(err => {
            console.error('Cloud save failed:', err);
            alert('فشل الحفظ السحابي على Firebase: ' + err.message);
        });
    }

    // استبدال دوال الحفظ السحابية لتكون سحابية فقط
    window.saveDB = function () {
        return pushFullStateToCloud();
    };

    window.saveToCloud = function () {
        return pushFullStateToCloud();
    };

    window.getCloudUsers = function () {
        return cloudUsersCache.length ? cloudUsersCache : DEFAULT_USERS.slice();
    };

    function initRealtimeCloudListener() {
        const rootRef = getCloudDBRef();
        if (!rootRef) return;

        rootRef.on('value', (snapshot) => {
            syncCloudToLocalMemory(snapshot.val());
        }, (error) => {
            console.error('Firebase listener error:', error);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRealtimeCloudListener);
    } else {
        initRealtimeCloudListener();
    }

    window.closeModal = function (modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.add('hidden');
    };

    window.deleteRecord = function (collectionName, index) {
        const db = getDB();
        if (!Array.isArray(db[collectionName])) return;
        if (index < 0 || index >= db[collectionName].length) return;
        if (typeof window.canModifyFinancialsOrAccounts === 'function' &&
            ['drivers', 'employees', 'vouchers', 'debtInvoices', 'transitVisas'].includes(collectionName) &&
            !window.canModifyFinancialsOrAccounts()) {
            alert('ليس لديك صلاحية حذف هذا السجل.');
            return;
        }
        if (!confirm('هل أنت متأكد من حذف هذا السجل نهائياً من السحابة؟')) return;
        db[collectionName].splice(index, 1);
        window.saveDB();
    };

    window.printThermalReceipt = function (type) {
        const areaId = type === 'cargo' ? 'cargoCaptureArea' : 'ticketCaptureArea';
        const area = document.getElementById(areaId);
        if (!area) return;
        const win = window.open('', '_blank', 'width=380,height=680');
        if (!win) {
            alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة الحرارية.');
            return;
        }
        win.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>إيصال حراري 80mm</title>
                <style>
                    @page { size: 80mm auto; margin: 2mm; }
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Cairo', 'Tajawal', sans-serif;
                        width: 76mm;
                        margin: 0 auto;
                        padding: 4px;
                        font-size: 11px;
                        color: #000;
                        background: #fff;
                    }
                    .no-print, button { display: none !important; }
                    svg { max-width: 100%; height: auto; }
                    img { max-width: 52px; max-height: 52px; }
                </style>
            </head>
            <body onload="window.print(); setTimeout(() => window.close(), 300);">
                ${area.outerHTML}
            </body>
            </html>
        `);
        win.document.close();
    };

    window.sendTripReminderWhatsApp = function () {
        const name = (document.getElementById('imgTktName')?.innerText || '').trim();
        const phoneRaw = (document.getElementById('imgTktPhone')?.innerText || '').trim();
        const date = (document.getElementById('imgTktDate')?.innerText || '').trim();
        const time = (document.getElementById('imgTktTime')?.innerText || '').trim();
        const route = (document.getElementById('imgTktRoute')?.innerText || '').trim();
        const phone = phoneRaw.replace(/\D/g, '');
        if (!phone) {
            alert('رقم هاتف الراكب غير متوفر.');
            return;
        }
        const msg = `مرحباً ${name}، نذكركم بموعد رحلتكم (${route}) بتاريخ ${date} - وقت الحضور: ${time}. شركة وادي بناء للنقل الدولي.`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    window.sendCargoReceiverWhatsApp = function () {
        const rName = (document.getElementById('imgCargoReceiverName')?.innerText || '').trim();
        const rPhoneRaw = (document.getElementById('imgCargoReceiverPhone')?.innerText || '').trim();
        const inv = (document.getElementById('imgCargoCode')?.innerText || '').trim();
        const firstPhone = (rPhoneRaw.split(/[-/,\s]+/).map(s => s.replace(/\D/g, '')).find(Boolean)) || '';
        if (!firstPhone) {
            alert('رقم هاتف المستلم غير متوفر.');
            return;
        }
        const msg = `مرحباً ${rName}، نفيدكم بوجود شحنة برقم الفاتورة ${inv} لدى شركة وادي بناء للنقل الدولي.`;
        window.open(`https://wa.me/${firstPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    window.renderDailyCashClosingReport = function () {
        const db = getDB();
        const dateInput = document.getElementById('dailyCloseDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        const targetDate = dateInput?.value || new Date().toISOString().split('T')[0];
        const filterFn = typeof window.getFilteredData === 'function' ? window.getFilteredData : (arr) => arr;

        const passList = filterFn(db.passengers || []).filter(p => p.date === targetDate && p.payMethod === 'مدفوع');
        const cargoList = filterFn(db.cargo || []).filter(c => c.date === targetDate && c.paymentStatus === 'مدفوع');
        const transitList = filterFn(db.transitVisas || []).filter(t => t.date === targetDate && t.paymentStatus === 'تم الدفع والاصدار');
        const vouchersList = filterFn(db.vouchers || []).filter(v => v.date === targetDate);
        const driversList = filterFn(db.drivers || []).filter(d => d.date === targetDate);

        const tPaid = passList.reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
        const cPaid = cargoList.reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
        const trPaid = transitList.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const vRec = vouchersList.filter(v => v.type === 'قبض').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
        const vExp = vouchersList.filter(v => v.type === 'صرف').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
        const dExp = driversList.reduce((s, d) => s + (parseFloat(d.totalExpenses) || 0), 0);

        const otherIn = trPaid + vRec;
        const totalOut = vExp + dExp;
        const netCash = (tPaid + cPaid + otherIn) - totalOut;

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        setTxt('dcTicketsPaid', `${tPaid} AED`);
        setTxt('dcCargoPaid', `${cPaid} AED`);
        setTxt('dcOtherIn', `${otherIn} AED`);
        setTxt('dcTotalOut', `${totalOut} AED`);
        setTxt('dcNetCash', `${netCash} AED`);
    };

    window.exportDailyClosingPDF = function () {
        const d = document.getElementById('dailyCloseDate')?.value || new Date().toISOString().split('T')[0];
        if (typeof window.exportToPDF === 'function') {
            window.exportToPDF('dailyClosingCaptureArea', `Daily_Cash_Closing_${d}`);
        }
    };

    window.renderDepartedTripsFinancials = function () {
        const tbody = document.querySelector('#finDepartedTripsTable tbody');
        const db = getDB();
        if (!tbody) return;
        tbody.innerHTML = '';

        const departedTrips = (db.trips || [])
            .filter(t => t.status === 'غادرت الرحلة')
            .sort((a, b) => String(b.id).localeCompare(String(a.id)));

        if (departedTrips.length === 0) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center text-zinc-500 py-5">لا توجد رحلات بحالة "غادرت الرحلة" حالياً.</td></tr>`;
            return;
        }

        departedTrips.forEach((trip, idx) => {
            const tripTickets = (db.passengers || []).filter(p => String(p.tripId) === String(trip.id));
            const tripCargo = (db.cargo || []).filter(c => String(c.tripId) === String(trip.id));

            const tktTotal = tripTickets.reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
            const cargoTotal = tripCargo.reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
            const grandTotal = tktTotal + cargoTotal;

            const tktPaid = tripTickets.filter(p => p.payMethod === 'مدفوع').reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
            const cargoPaid = tripCargo.filter(c => c.paymentStatus === 'مدفوع').reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
            const paidTotal = tktPaid + cargoPaid;
            const remainingTotal = grandTotal - paidTotal;

            const drvExp = (db.drivers || [])
                .filter(d => d.date === trip.date)
                .reduce((s, d) => s + (parseFloat(d.totalExpenses) || 0), 0);

            const netTripProfit = paidTotal - drvExp;

            tbody.insertRow().innerHTML = `
                <td><strong>#${departedTrips.length - idx}</strong></td>
                <td><strong class="text-gold">${escapeHTML(trip.date)}</strong></td>
                <td>${escapeHTML(trip.route)}</td>
                <td>${escapeHTML(trip.busInfo)}</td>
                <td><span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded font-bold">${tripTickets.length}</span></td>
                <td><span class="bg-amber-950 text-amber-300 px-2 py-0.5 rounded font-bold">${tripCargo.length}</span></td>
                <td class="font-bold text-gold">${grandTotal} AED</td>
                <td class="font-bold text-emerald-400">${paidTotal} AED</td>
                <td class="font-bold text-amber-300">${remainingTotal} AED</td>
                <td class="font-bold text-red-400">${drvExp} AED</td>
                <td class="font-black ${netTripProfit >= 0 ? 'text-emerald-400' : 'text-red-500'}">${netTripProfit} AED</td>
                <td>
                    <button onclick="openTripDetailsModal('${escapeHTML(trip.id)}', 'finance')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded text-xs font-bold">
                        <i class="fa-solid fa-folder-open ml-1"></i> إدارة الرحلة
                    </button>
                </td>
            `;
        });
    };

    window.openTripDetailsModal = function (tripId, mode = 'ops') {
        const db = getDB();
        const trip = (db.trips || []).find(t => String(t.id) === String(tripId));
        if (!trip) return;

        activeTripDetailsId = tripId;
        activeTripDetailsMode = mode;

        const titleEl = document.getElementById('tripDetailsModalTitle');
        const subEl = document.getElementById('tripDetailsModalSub');
        if (titleEl) titleEl.innerText = `تفاصيل الرحلة: ${trip.route}`;
        if (subEl) subEl.innerText = `التاريخ: ${trip.date} | الباص: ${trip.busInfo} | الحالة: ${trip.status || 'مجدولة'}`;

        const addBar = document.getElementById('departedTripFinanceAddBar');
        const finBar = document.getElementById('tripFinancialSummaryBar');
        const isFin = mode === 'finance' && (typeof window.canModifyFinancialsOrAccounts === 'function' ? window.canModifyFinancialsOrAccounts() : true);

        if (addBar) addBar.classList.toggle('hidden', !isFin);
        if (finBar) finBar.classList.toggle('hidden', !isFin);

        const tickets = (db.passengers || []).filter(p => String(p.tripId) === String(tripId));
        const cargos = (db.cargo || []).filter(c => String(c.tripId) === String(tripId));

        if (document.getElementById('tripBranchTktCount')) document.getElementById('tripBranchTktCount').innerText = tickets.length;
        if (document.getElementById('tripBranchCargoCount')) document.getElementById('tripBranchCargoCount').innerText = cargos.length;

        const tktSum = tickets.reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
        const cargoSum = cargos.reduce((s, c) => s + (parseFloat(c.grandTotal) || 0), 0);
        if (document.getElementById('tripFinTktTotal')) document.getElementById('tripFinTktTotal').innerText = `${tktSum} AED`;
        if (document.getElementById('tripFinCargoTotal')) document.getElementById('tripFinCargoTotal').innerText = `${cargoSum} AED`;
        if (document.getElementById('tripFinGrandTotal')) document.getElementById('tripFinGrandTotal').innerText = `${tktSum + cargoSum} AED`;

        const tHead = document.getElementById('tripBranchTicketsHead');
        const tBody = document.getElementById('tripBranchTicketsBody');
        if (tHead && tBody) {
            tHead.innerHTML = `<tr><th>التذكرة</th><th>الراكب</th><th>الهاتف</th><th>المسار</th><th>المبلغ</th><th>السداد</th><th>إجراء</th></tr>`;
            tBody.innerHTML = tickets.length ? '' : `<tr><td colspan="7" class="text-center text-zinc-500 py-4">لا توجد تذاكر مرتبطة بهذه الرحلة.</td></tr>`;
            tickets.forEach(p => {
                tBody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${escapeHTML(p.id)}</strong></td>
                    <td>${escapeHTML(p.name)}</td>
                    <td>${escapeHTML(p.phone)}</td>
                    <td>${escapeHTML(p.origin)} ➔ ${escapeHTML(p.destination)}</td>
                    <td class="font-bold text-gold">${escapeHTML(p.fare)} AED</td>
                    <td>${escapeHTML(p.payMethod)}</td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="closeModal('tripDetailsModal'); previewTicketImage('${escapeHTML(p.id)}')" class="bg-sky-600 text-white px-2 py-1 rounded text-xs">معاينة</button>
                        <button onclick="closeModal('tripDetailsModal'); editPassenger('${escapeHTML(p.id)}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold">تعديل</button>
                    </td>
                `;
            });
        }

        const cHead = document.getElementById('tripBranchCargoHead');
        const cBody = document.getElementById('tripBranchCargoBody');
        if (cHead && cBody) {
            cHead.innerHTML = `<tr><th>الفاتورة</th><th>المرسل</th><th>المستلم</th><th>الإجمالي</th><th>السداد</th><th>إجراء</th></tr>`;
            cBody.innerHTML = cargos.length ? '' : `<tr><td colspan="6" class="text-center text-zinc-500 py-4">لا توجد فواتير شحن مرتبطة بهذه الرحلة.</td></tr>`;
            cargos.forEach(c => {
                cBody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${escapeHTML(c.id)}</strong></td>
                    <td>${escapeHTML(c.sender)}</td>
                    <td>${escapeHTML(c.receiver)}</td>
                    <td class="font-bold text-gold">${escapeHTML(c.grandTotal)} AED</td>
                    <td>${escapeHTML(c.paymentStatus)}</td>
                    <td class="space-x-1 space-x-reverse">
                        <button onclick="closeModal('tripDetailsModal'); previewCargoImage('${escapeHTML(c.id)}')" class="bg-sky-600 text-white px-2 py-1 rounded text-xs">معاينة</button>
                        <button onclick="closeModal('tripDetailsModal'); editCargo('${escapeHTML(c.id)}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold">تعديل</button>
                    </td>
                `;
            });
        }

        window.switchTripDetailsBranch('tickets');
        const modal = document.getElementById('tripDetailsModal');
        if (modal) modal.classList.remove('hidden');
    };

    window.switchTripDetailsBranch = function (branch) {
        const tCont = document.getElementById('tripBranchTicketsContainer');
        const cCont = document.getElementById('tripBranchCargoContainer');
        const btnT = document.getElementById('btnTripSubTickets');
        const btnC = document.getElementById('btnTripSubCargo');

        if (branch === 'tickets') {
            tCont?.classList.remove('hidden');
            cCont?.classList.add('hidden');
            if (btnT) btnT.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition gold-gradient-bg text-black shadow";
            if (btnC) btnC.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition bg-zinc-800 text-zinc-300 hover:text-gold border border-zinc-700";
        } else {
            cCont?.classList.remove('hidden');
            tCont?.classList.add('hidden');
            if (btnC) btnC.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition gold-gradient-bg text-black shadow";
            if (btnT) btnT.className = "py-3 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition bg-zinc-800 text-zinc-300 hover:text-gold border border-zinc-700";
        }
    };

    window.openAddTicketForDepartedTrip = function () {
        if (!activeTripDetailsId) return;
        window.closeModal('tripDetailsModal');
        if (typeof window.switchTab === 'function') window.switchTab('passengers');
        if (typeof window.resetPassengerForm === 'function') window.resetPassengerForm();
        if (typeof window.setFinanceOverrideTrip === 'function') window.setFinanceOverrideTrip(activeTripDetailsId);
        const sel = document.getElementById('passTripSelect');
        if (sel) {
            sel.value = activeTripDetailsId;
            sel.dispatchEvent(new Event('change'));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.openAddCargoForDepartedTrip = function () {
        if (!activeTripDetailsId) return;
        window.closeModal('tripDetailsModal');
        if (typeof window.switchTab === 'function') window.switchTab('cargo');
        if (typeof window.resetCargoForm === 'function') window.resetCargoForm();
        if (typeof window.setFinanceOverrideTrip === 'function') window.setFinanceOverrideTrip(activeTripDetailsId);
        const sel = document.getElementById('cargoTripSelect');
        if (sel) {
            sel.value = activeTripDetailsId;
            sel.dispatchEvent(new Event('change'));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.handleGlobalSearch = function () {
        const db = getDB();
        const q = (document.getElementById('globalSearchInput')?.value || '').toLowerCase().trim();
        const type = document.getElementById('globalSearchType')?.value || 'all';
        const payFilter = document.getElementById('advFilterPayment')?.value || 'all';
        const origFilter = document.getElementById('advFilterOrigin')?.value || 'all';
        const destFilter = document.getElementById('advFilterDestination')?.value || 'all';
        const filterFn = typeof window.getFilteredData === 'function' ? window.getFilteredData : (arr) => arr;
        const sortFn = typeof window.compareInvoiceIdsDesc === 'function' ? window.compareInvoiceIdsDesc : (a, b) => String(b.id).localeCompare(String(a.id));

        const pTbody = document.querySelector('#passengersTable tbody');
        if (pTbody) {
            pTbody.innerHTML = '';
            let list = filterFn(db.passengers || []);
            if (type === 'cargo') list = [];

            list = list.filter(p => {
                if (payFilter !== 'all' && p.payMethod !== payFilter) return false;
                if (origFilter !== 'all' && p.origin !== origFilter) return false;
                if (destFilter !== 'all' && p.destination !== destFilter) return false;
                if (!q) return true;
                const extraStr = (p.extraPassengers || []).map(e => `${e.name || ''} ${e.passport || ''} ${e.ticketNo || ''}`).join(' ');
                return (
                    String(p.id || '').toLowerCase().includes(q) ||
                    String(p.name || '').toLowerCase().includes(q) ||
                    String(p.phone || '').toLowerCase().includes(q) ||
                    String(p.agent || '').toLowerCase().includes(q) ||
                    extraStr.toLowerCase().includes(q)
                );
            }).sort(sortFn);

            if (document.getElementById('statTicketCount')) document.getElementById('statTicketCount').innerText = list.length;
            if (document.getElementById('statTicketRevenue')) {
                const rev = list.reduce((s, p) => s + (parseFloat(p.fare) || 0), 0);
                document.getElementById('statTicketRevenue').innerText = `${rev} AED`;
            }

            list.forEach(p => {
                const realIdx = (db.passengers || []).findIndex(x => String(x.id) === String(p.id));
                const extras = (p.extraPassengers || []).map(e => `${e.name}${e.ticketNo ? ` (#${e.ticketNo})` : ''}`).join('، ') || '-';
                pTbody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${escapeHTML(p.id)}</strong></td>
                    <td>${escapeHTML(p.agent || '-')}</td>
                    <td><strong>${escapeHTML(p.name)}</strong></td>
                    <td class="text-xs text-zinc-300">${escapeHTML(extras)}</td>
                    <td class="font-mono text-xs">${escapeHTML(p.phone)}</td>
                    <td>${escapeHTML(p.origin)} ➔ ${escapeHTML(p.destination)}</td>
                    <td>${escapeHTML(p.date || '-')}</td>
                    <td class="font-bold text-gold">${escapeHTML(p.fare)} AED</td>
                    <td class="text-xs text-zinc-400">${escapeHTML(p.notes || '-')}</td>
                    <td><span class="bg-zinc-800 px-2 py-0.5 rounded text-xs font-bold">${escapeHTML(p.payMethod)}</span></td>
                    <td><span class="bg-zinc-800 px-2 py-0.5 rounded text-xs">${escapeHTML(p.branch || 'فرع عجمان')}</span></td>
                    <td class="space-x-1 space-x-reverse whitespace-nowrap">
                        <button onclick="previewTicketImage('${escapeHTML(p.id)}')" class="bg-sky-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="editPassenger('${escapeHTML(p.id)}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteRecord('passengers', ${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
            });
        }

        const cTbody = document.querySelector('#cargoTable tbody');
        if (cTbody) {
            cTbody.innerHTML = '';
            let clist = filterFn(db.cargo || []);
            if (type === 'ticket') clist = [];

            clist = clist.filter(c => {
                if (payFilter !== 'all' && c.paymentStatus !== payFilter) return false;
                if (origFilter !== 'all' && c.senderAddress !== origFilter) return false;
                if (destFilter !== 'all' && c.receiverAddress !== destFilter) return false;
                if (!q) return true;
                const itemsStr = (c.items || []).map(i => i.desc || '').join(' ');
                return (
                    String(c.id || '').toLowerCase().includes(q) ||
                    String(c.sender || '').toLowerCase().includes(q) ||
                    String(c.senderPhone || '').toLowerCase().includes(q) ||
                    String(c.receiver || '').toLowerCase().includes(q) ||
                    String(c.receiverPhone || '').toLowerCase().includes(q) ||
                    itemsStr.toLowerCase().includes(q)
                );
            }).sort(sortFn);

            clist.forEach(c => {
                const realIdx = (db.cargo || []).findIndex(x => String(x.id) === String(c.id));
                const tripObj = (db.trips || []).find(t => String(t.id) === String(c.tripId));
                const tripLabel = tripObj ? `${tripObj.date !== '-' ? tripObj.date : ''} (${tripObj.route})` : '-';
                const itemsCount = (c.items || []).length;
                cTbody.insertRow().innerHTML = `
                    <td><strong class="text-gold">#${escapeHTML(c.id)}</strong></td>
                    <td>${escapeHTML(c.date || '-')}</td>
                    <td><strong>${escapeHTML(c.sender)}</strong><div class="text-[11px] text-zinc-400">${escapeHTML(c.senderPhone || '')}</div></td>
                    <td><strong>${escapeHTML(c.receiver)}</strong><div class="text-[11px] text-zinc-400">${escapeHTML(c.receiverAddress || '')}</div></td>
                    <td class="text-xs text-indigo-300">${escapeHTML(tripLabel)}</td>
                    <td><span class="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">${itemsCount}</span></td>
                    <td class="font-bold text-gold">${escapeHTML(c.grandTotal)} AED</td>
                    <td class="text-xs text-zinc-400">${escapeHTML(c.notes || '-')}</td>
                    <td><span class="bg-zinc-800 px-2 py-0.5 rounded text-xs font-bold">${escapeHTML(c.paymentStatus)}</span></td>
                    <td><span class="bg-zinc-800 px-2 py-0.5 rounded text-xs">${escapeHTML(c.branch || 'فرع عجمان')}</span></td>
                    <td class="space-x-1 space-x-reverse whitespace-nowrap">
                        <button onclick="previewCargoImage('${escapeHTML(c.id)}')" class="bg-sky-600 text-white px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="editCargo('${escapeHTML(c.id)}')" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteRecord('cargo', ${realIdx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                    </td>
                `;
            });
        }
    };

    window.resetGlobalSearch = function () {
        if (document.getElementById('globalSearchInput')) document.getElementById('globalSearchInput').value = '';
        if (document.getElementById('globalSearchType')) document.getElementById('globalSearchType').value = 'all';
        if (document.getElementById('advFilterPayment')) document.getElementById('advFilterPayment').value = 'all';
        if (document.getElementById('advFilterOrigin')) document.getElementById('advFilterOrigin').value = 'all';
        if (document.getElementById('advFilterDestination')) document.getElementById('advFilterDestination').value = 'all';
        window.handleGlobalSearch();
    };

    window.exportExcel = function (section) {
        const db = getDB();
        if (typeof XLSX === 'undefined') {
            alert('مكتبة تصدير Excel غير محملة.');
            return;
        }
        const rows = section === 'cargo' ? (db.cargo || []) : (db.passengers || []);
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, section || 'Data');
        XLSX.writeFile(wb, `WadiBina_${section}_${Date.now()}.xlsx`);
    };

    window.exportBackupJSON = function () {
        const db = getDB();
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `WadiBina_CloudBackup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    window.importBackupJSON = function (event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed && typeof parsed === 'object') {
                    window.db = Object.assign(getDB(), parsed);
                    window.saveDB().then(() => {
                        alert('تم رفع واسترجاع النسخة الاحتياطية إلى السحابة بنجاح!');
                    });
                } else {
                    alert('ملف JSON غير صالح.');
                }
            } catch (err) {
                alert('تعذر قراءة ملف JSON: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    window.exportSystemBackupPDF = function () {
        const db = getDB();
        const repArea = document.getElementById('systemReportPrintArea');
        if (!repArea) return;

        if (document.getElementById('reportDateBadge')) document.getElementById('reportDateBadge').innerText = new Date().toLocaleDateString('ar-AE');
        if (document.getElementById('reportUserBadge')) document.getElementById('reportUserBadge').innerText = typeof window.getCurrentUserName === 'function' ? window.getCurrentUserName() : 'النظام';
        if (document.getElementById('repTotalTkt')) document.getElementById('repTotalTkt').innerText = (db.passengers || []).length;
        if (document.getElementById('repTotalCargo')) document.getElementById('repTotalCargo').innerText = (db.cargo || []).length;
        if (document.getElementById('repTotalDebt')) document.getElementById('repTotalDebt').innerText = (db.debtInvoices || []).length;

        const tbody = document.getElementById('repTicketsTbody');
        if (tbody) {
            tbody.innerHTML = '';
            (db.passengers || []).slice(0, 40).forEach(p => {
                tbody.insertRow().innerHTML = `
                    <td class="border border-slate-300 p-2">#${escapeHTML(p.id)}</td>
                    <td class="border border-slate-300 p-2">${escapeHTML(p.name)}</td>
                    <td class="border border-slate-300 p-2">${escapeHTML(p.phone)}</td>
                    <td class="border border-slate-300 p-2">${escapeHTML(p.origin)} ➔ ${escapeHTML(p.destination)}</td>
                    <td class="border border-slate-300 p-2">${escapeHTML(p.fare)} AED</td>
                    <td class="border border-slate-300 p-2">${escapeHTML(p.payMethod)}</td>
                `;
            });
        }

        repArea.classList.remove('hidden');
        if (typeof window.exportToPDF === 'function') {
            window.exportToPDF('systemReportPrintArea', `WadiBina_Report_${Date.now()}`);
        }
        setTimeout(() => repArea.classList.add('hidden'), 1500);
    };

    window.importBackupPDF = async function (event) {
        const file = event.target.files?.[0];
        if (!file || typeof pdfjsLib === 'undefined') {
            alert('مكتبة قراءة PDF غير متوفرة.');
            event.target.value = '';
            return;
        }
        try {
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(it => it.str).join(' ') + '\n';
            }
            const jsonMatch = text.match(/\{[\s\S]*"passengers"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                window.db = Object.assign(getDB(), parsed);
                window.saveDB().then(() => {
                    alert('تم استعادة البيانات ورفعها إلى السحابة بنجاح!');
                });
            } else {
                alert('لم يتم العثور على بيانات نسخة احتياطية مضمنة داخل ملف PDF.');
            }
        } catch (err) {
            alert('تعذر قراءة ملف PDF: ' + err.message);
        }
        event.target.value = '';
    };

    // إدارة المستخدمين عبر السحابة مباشرة
    window.renderUsersTable = function () {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const users = window.getCloudUsers();
        users.forEach((u, idx) => {
            tbody.insertRow().innerHTML = `
                <td><strong>${escapeHTML(u.username)}</strong></td>
                <td class="font-mono text-gold">${escapeHTML(u.password)}</td>
                <td><span class="bg-zinc-800 px-2 py-0.5 rounded text-xs font-bold">${escapeHTML(u.role)}</span></td>
                <td>${escapeHTML(u.branch || 'فرع عجمان')}</td>
                <td class="space-x-1 space-x-reverse">
                    <button onclick="editSystemUser(${idx})" class="bg-amber-600 text-black px-2 py-1 rounded text-xs font-bold"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteSystemUser(${idx})" class="bg-red-900 text-white px-2 py-1 rounded text-xs"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
        });
    };

    window.handleSaveUser = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        const orig = (document.getElementById('userEditOriginalName')?.value || '').trim();
        const username = (document.getElementById('manageUsername')?.value || '').trim();
        const password = (document.getElementById('managePassword')?.value || '').trim();
        const role = document.getElementById('manageRole')?.value || 'موظف حجز وتذاكر';
        const branch = document.getElementById('manageBranch')?.value || 'فرع عجمان';
        if (!username || !password) {
            alert('يرجى إدخال اسم المستخدم وكلمة المرور.');
            return;
        }

        const users = window.getCloudUsers().slice();
        if (orig) {
            const idx = users.findIndex(u => u.username === orig);
            if (idx !== -1) users[idx] = { username, password, role, branch };
        } else {
            if (users.some(u => u.username === username)) {
                alert('اسم المستخدم موجود مسبقاً!');
                return;
            }
            users.push({ username, password, role, branch });
        }

        cloudUsersCache = users;
        window.saveDB().then(() => {
            window.resetUserForm();
            window.renderUsersTable();
        });
    };

    window.editSystemUser = function (idx) {
        const users = window.getCloudUsers();
        const u = users[idx];
        if (!u) return;
        if (document.getElementById('userEditOriginalName')) document.getElementById('userEditOriginalName').value = u.username;
        if (document.getElementById('manageUsername')) document.getElementById('manageUsername').value = u.username;
        if (document.getElementById('managePassword')) document.getElementById('managePassword').value = u.password;
        if (document.getElementById('manageRole')) document.getElementById('manageRole').value = u.role;
        if (document.getElementById('manageBranch')) document.getElementById('manageBranch').value = u.branch || 'فرع عجمان';
        if (document.getElementById('userSubmitBtn')) document.getElementById('userSubmitBtn').innerText = 'حفظ تعديل المستخدم';
    };

    window.deleteSystemUser = function (idx) {
        const users = window.getCloudUsers().slice();
        if (!users[idx]) return;
        if (users[idx].username === 'محمود') {
            alert('لا يمكن حذف الحساب الرئيسي للمستخدم محمود.');
            return;
        }
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
        users.splice(idx, 1);
        cloudUsersCache = users;
        window.saveDB().then(() => {
            window.renderUsersTable();
        });
    };

    window.resetUserForm = function () {
        const form = document.getElementById('userForm');
        if (form) form.reset();
        if (document.getElementById('userEditOriginalName')) document.getElementById('userEditOriginalName').value = '';
        if (document.getElementById('userSubmitBtn')) document.getElementById('userSubmitBtn').innerText = 'إضافة مستخدم جديد';
    };
})();
