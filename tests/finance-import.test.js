'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('gestione_cc/www/app.js', 'utf8');
function extract(name, nextName) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'Funzione non trovata: ' + name);
  const end = source.indexOf('function ' + nextName + '(', start + 1);
  assert.notEqual(end, -1, 'Delimitatore non trovato: ' + nextName);
  return source.slice(start, end);
}
const parseAmount = extract('parseAmount', 'parseQifDate');
const ofxParser = extract('parseOfxDate', 'parseQif');
const context = { uid: prefix => prefix + '-test', parseAmount: null };
vm.createContext(context);
vm.runInContext(parseAmount + '\n' + ofxParser + '\nthis.parseOfx = parseOfx;', context);
assert.equal(context.parseAmount('1.234,56'), 1234.56);
assert.equal(context.parseAmount('-45.90'), -45.9);
assert.equal(context.parseAmount('(12,50)'), -12.5);

const xml = `<?xml version="1.0"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261015</DTPOSTED><TRNAMT>-45.90</TRNAMT><FITID>ABC-001</FITID><NAME>Supermercato</NAME><MEMO>Spesa settimanale</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261020</DTPOSTED><TRNAMT>1250.00</TRNAMT><FITID>ABC-002</FITID><NAME>Stipendio</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
const parsedXml = context.parseOfx(xml);
assert.equal(parsedXml.length, 2);
assert.equal(parsedXml[0].date, '2026-10-15');
assert.equal(parsedXml[0].amount, -45.9);
assert.equal(parsedXml[0].fitid, 'ABC-001');
assert.equal(parsedXml[0].description, 'Supermercato');
assert.equal(parsedXml[1].amount, 1250);

const sgml = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261101
<TRNAMT>-9,99
<FITID>SGML-001
<NAME>Bar
<MEMO>Caffe
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261102
<TRNAMT>20.00
<FITID>SGML-002
<NAME>Rimborso
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
const parsedSgml = context.parseOfx(sgml);
assert.equal(parsedSgml.length, 2);
assert.equal(parsedSgml[0].amount, -9.99);
assert.equal(parsedSgml[0].memo, 'Caffe');
assert.equal(parsedSgml[1].date, '2026-11-02');
assert.equal(context.parseOfx('<OFX></OFX>').length, 0);
console.log('OK: importi, date, OFX XML, OFX SGML e file senza movimenti.');
