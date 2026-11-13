import ast
import re
import unittest
from pathlib import Path


SERVER = Path(__file__).resolve().parents[1] / "gestione_cc" / "server.py"
TREE = ast.parse(SERVER.read_text(encoding="utf-8"))
TARGETS = {"valid_attachment_signature", "classify_document", "extract_document_metadata"}
NAMESPACE = {"re": re}
for node in TREE.body:
    if isinstance(node, ast.FunctionDef) and node.name in TARGETS:
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), "exec"), NAMESPACE)


class DocumentOcrHelpersTest(unittest.TestCase):
    def test_attachment_signatures(self):
        valid = NAMESPACE["valid_attachment_signature"]
        self.assertTrue(valid("image/jpeg", b"\xff\xd8\xff" + b"jpeg"))
        self.assertTrue(valid("image/png", b"\x89PNG\r\n\\x1a\n" + b"png"))
        self.assertTrue(valid("application/pdf", b"%PDF-1.7"))
        self.assertFalse(valid("image/jpeg", b"not a jpeg"))
        self.assertFalse(valid("image/png", b"\x89PNGbad"))
        self.assertFalse(valid("application/pdf", b"not a pdf"))


    def test_document_classification(self):
        classify = NAMESPACE["classify_document"]
        self.assertEqual(classify("Modello F24 - codice tributo"), "f24")
        self.assertEqual(classify("Bollettino conto corrente postale"), "bollettino")
        self.assertEqual(classify("Fattura elettronica imponibile IVA 22%"), "fattura")
        self.assertEqual(classify("Documento generico", "scan.png"), "altro")

    def test_metadata_extraction(self):
        extract = NAMESPACE["extract_document_metadata"]
        result = extract(
            "ACME Energia\nFattura del 12/10/2026\n"
            "Codice fiscale RSSMRA80A01H501U\n"
            "Totale da pagare: 1.234,56"
        )
        self.assertEqual(result["document_date"], "12/10/2026")
        self.assertEqual(result["amount"], "1.234,56")
        self.assertEqual(result["fiscal_code"], "RSSMRA80A01H501U")
        self.assertEqual(result["supplier"], "ACME Energia")


if __name__ == "__main__":
    unittest.main()
