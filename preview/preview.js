(function () {
  'use strict';

  var selectedFile = null;
  var simulateReaderFailure = false;
  var input = document.getElementById('bcExcelFile');
  var analyseButton = document.getElementById('analyseButton');
  var failureButton = document.getElementById('readerFailureButton');

  function byId(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function text(tag, value) { var node = document.createElement(tag); node.textContent = value; return node; }
  function status(message, isError) {
    var box = byId('bcExcelStatus');
    clear(box);
    var item = text('div', message);
    item.className = isError ? 'error' : 'status';
    item.setAttribute('role', 'status');
    box.appendChild(item);
  }
  function list(title, items, className) {
    if (!items.length) return null;
    var box = document.createElement('div');
    box.className = className;
    box.appendChild(text('strong', title));
    var ul = document.createElement('ul');
    items.forEach(function (message) { ul.appendChild(text('li', message)); });
    box.appendChild(ul);
    return box;
  }
  function showResult(result) {
    var summary = byId('summary');
    var messages = byId('messages');
    var body = byId('rows');
    clear(summary); clear(messages); clear(body);
    summary.appendChild(text('p', result.rows.length + ' líneas válidas · ' + result.products + ' artículos · ' +
      result.locations + ' ubicaciones · almacén ' + (result.warehouse || 'no identificado') + '.'));
    var errors = list('Errores que impedirían una importación:', result.errors, 'error');
    var warnings = list('Advertencias:', result.warnings, 'warning');
    if (errors) messages.appendChild(errors);
    if (warnings) messages.appendChild(warnings);
    result.rows.slice(0, 100).forEach(function (row) {
      var tr = document.createElement('tr');
      [row.row_number, row.location_code, row.product_code, row.lot || '—', String(row.quantity), row.expiry_date || '—']
        .forEach(function (value) { tr.appendChild(text('td', value)); });
      body.appendChild(tr);
    });
    byId('results').hidden = false;
  }
  function blockNetwork() {
    window.fetch = function () { return Promise.reject(Error('Red deshabilitada en la vista previa aislada.')); };
    window.XMLHttpRequest = function () { throw Error('Red deshabilitada en la vista previa aislada.'); };
    window.WebSocket = function () { throw Error('Red deshabilitada en la vista previa aislada.'); };
    window.EventSource = function () { throw Error('Red deshabilitada en la vista previa aislada.'); };
  }

  blockNetwork();
  window.INVENTA_MGMT = Object.freeze({
    isAdmin: function () { return false; },
    getUserId: function () { return null; },
    realApi: function () { return Promise.reject(Error('Publicación deshabilitada en DEMO.')); },
    render: function () { return Promise.resolve(); }
  });
  window.INVENTA_BC.commit = function () {
    status('DEMO: la publicación está deshabilitada y no se ha enviado ningún dato.', true);
  };

  input.addEventListener('change', function () {
    selectedFile = input.files && input.files[0] || null;
    window.INVENTA_BC.fileSelected(input);
    byId('results').hidden = true;
  });

  analyseButton.addEventListener('click', async function () {
    if (!selectedFile) { status('Selecciona primero un archivo Excel.', true); return; }
    if (!/\.xlsx$/i.test(selectedFile.name)) { status('Solo se admiten archivos .xlsx.', true); return; }
    if (selectedFile.size > 20 * 1024 * 1024) { status('El archivo supera el límite de 20 MB.', true); return; }
    if (simulateReaderFailure || !window.ExcelJS) {
      status('DEMO de fallo: ExcelJS no está disponible. Restaura el lector y vuelve a intentarlo.', true);
      return;
    }
    analyseButton.disabled = true;
    status('Analizando localmente «' + selectedFile.name + '»…');
    try {
      var workbook = new window.ExcelJS.Workbook();
      await workbook.xlsx.load(await selectedFile.arrayBuffer());
      var sheet = workbook.worksheets[0];
      if (!sheet) throw Error('El Excel no contiene hojas.');
      var result = window.INVENTA_BC.parseRows(window.INVENTA_BC.sheetToMatrix(sheet), selectedFile.name);
      showResult(result);
      status(result.errors.length ? 'Análisis terminado con errores. No se puede publicar desde esta DEMO.' :
        'Análisis local completado. La publicación permanece deshabilitada.', result.errors.length > 0);
    } catch (error) {
      status('No se pudo analizar el Excel: ' + error.message, true);
    } finally {
      analyseButton.disabled = false;
    }
  });

  failureButton.addEventListener('click', function () {
    simulateReaderFailure = !simulateReaderFailure;
    failureButton.textContent = simulateReaderFailure ? 'Restaurar lector ExcelJS' : 'Simular fallo del lector ExcelJS';
    status(simulateReaderFailure ? 'Fallo del lector activado para la siguiente prueba.' : 'Lector ExcelJS restaurado.');
  });

  if (!window.ExcelJS || !window.INVENTA_BC) {
    analyseButton.disabled = true;
    status('No se pudo inicializar el lector o el importador. Recarga la página.', true);
  }
}());
