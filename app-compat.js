/*
 * Wadi Bina page compatibility helpers.
 * Include this file with a classic <script> tag near the end of index.html.
 * It provides the shared Firebase configuration and missing global print/name
 * helpers; the existing ES module remains the owner of application state and data.
 */
(function () {
  'use strict';

  window.firebaseConfig = {
    apiKey: "AIzaSyCX0AnjNnffeRCFGDugKeOI8k8adJC1aqs",
    authDomain: "wadi-bana-b585b.firebaseapp.com",
    databaseURL: "https://wadi-bana-b585b-default-rtdb.firebaseio.com",
    projectId: "wadi-bana-b585b",
    storageBucket: "wadi-bana-b585b.firebasestorage.app",
    messagingSenderId: "57806694102",
    appId: "1:57806694102:web:8b2f38f1b86c0240290b77",
    measurementId: "G-DR3Y513XP9"
  };

  const pageStyle = () => document.getElementById('dynamicPrintPageStyle');
  let restoreTimer;

  function safeFilePart(value, fallback) {
    const cleaned = String(value || '')
      .replace(/^#+/, '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '');
    return cleaned || fallback;
  }

  function displayedCode(elementId, fallback) {
    const el = document.getElementById(elementId);
    return safeFilePart(el ? el.textContent : '', fallback);
  }

  function printWithPage(size) {
    const style = pageStyle();
    if (style) style.textContent = `@page { size: ${size}; margin: 6mm; }`;

    const restore = () => {
      if (style) style.textContent = '@page { size: A5 portrait; margin: 6mm; }';
      window.removeEventListener('afterprint', restore);
      if (restoreTimer) window.clearTimeout(restoreTimer);
      restoreTimer = undefined;
    };

    window.addEventListener('afterprint', restore, { once: true });
    if (restoreTimer) window.clearTimeout(restoreTimer);
    // Some mobile browsers do not reliably fire afterprint.
    restoreTimer = window.setTimeout(restore, 60000);
    window.print();
  }

  window.printDocumentA5 = function printDocumentA5() {
    printWithPage('A5 portrait');
  };

  window.printDocumentLandscape = function printDocumentLandscape() {
    printWithPage('A4 landscape');
  };

  window.getTicketFileName = function getTicketFileName() {
    return `WadiBina_Ticket_${displayedCode('imgTicketCode', 'ticket')}`;
  };

  window.getCargoFileName = function getCargoFileName() {
    return `WadiBina_CargoInvoice_${displayedCode('imgCargoCode', 'cargo')}`;
  };

  window.getDebtFileName = function getDebtFileName() {
    return `WadiBina_DebtInvoice_${displayedCode('imgDebtInvCode', 'invoice')}`;
  };
})();
