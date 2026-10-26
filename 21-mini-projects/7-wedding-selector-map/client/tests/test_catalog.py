import importlib.util
from pathlib import Path
import unittest
import json
import hashlib

spec = importlib.util.spec_from_file_location('catalog', Path(__file__).resolve().parents[1] / 'scripts/build_catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class MoneyTests(unittest.TestCase):
    def test_currency_units_and_ranges(self):
        self.assertEqual(catalog.money_values('5~7만원'), [50000,70000])
        self.assertEqual(catalog.money_values('5만5천원'), [55000])
        self.assertEqual(catalog.money_values('58천원~78천원'), [58000,78000])
        self.assertEqual(catalog.money_values('1천만원'), [10000000])
        self.assertEqual(catalog.money_values('55.000~77.000'), [55000,77000])

    def test_guests_years_month_lists_missing_and_zero(self):
        self.assertEqual(catalog.money_values('2027년 기본 300명'), [])
        self.assertEqual(catalog.money_values('비수기(1,2,7,8)월'), [])
        self.assertEqual(catalog.money_values('미공개'), [])
        self.assertEqual(catalog.money_values('-'), [])
        self.assertEqual(catalog.money_values('무료'), [0])
        self.assertEqual(catalog.clean(0), '0')


class SourceRegressionTests(unittest.TestCase):
    def source(self, identifier):
        path = next(catalog.BASE.glob(f'*/*__{identifier}.xlsx'))
        return catalog.sheets_from_xlsx(path)

    def base_meals(self, identifier):
        offers = catalog.parse_offers(self.source(identifier)[0])
        return [o for o in offers if not o['additional']]

    def test_drink_supplement_is_not_a_meal(self):
        offers = self.base_meals('31463')
        self.assertEqual(min(o['meal']['min'] for o in offers), 62700)
        self.assertNotIn(8800, [o['meal']['min'] for o in offers])

    def test_discount_amount_is_not_a_payable_price(self):
        offers = self.base_meals('31828')
        self.assertEqual(min(o['meal']['min'] for o in offers), 46000)
        self.assertTrue(all(o['rental']['min'] == 3800000 for o in offers))

    def test_package_total_and_additional_person_are_not_base_unit_prices(self):
        self.assertEqual(self.base_meals('31627'), [])

    def test_unmerged_food_header_and_combined_rental(self):
        offers = self.base_meals('31645')
        self.assertEqual(min(o['meal']['min'] for o in offers), 63000)
        offers = self.base_meals('31642')
        self.assertEqual(offers[0]['rentalKind'], 'combined')
        self.assertEqual(offers[0]['rental']['min'], 700000)

    def test_month_subheaders_are_not_prices_and_multiple_tables_are_read(self):
        offers = self.base_meals('31826')
        self.assertEqual(min(o['meal']['min'] for o in offers), 42000)
        offers = self.base_meals('31419')
        self.assertGreater(len({o['hall'] for o in offers}), 1)


class CatalogueAcceptanceTests(unittest.TestCase):
    def test_all_post_profiles_and_readable_documents_are_present(self):
        data = json.loads((catalog.BASE / 'catalog.json').read_text())
        posts = json.loads((catalog.BASE / '게시글_기본정보.json').read_text())['posts']
        self.assertEqual({p['post_id'] for p in posts}, {v['postId'] for v in data['venues']})
        self.assertEqual(len(data['venues']), len({v['id'] for v in data['venues']}))
        for venue in data['venues']:
            document = (catalog.ROOT / venue['files']['md']).read_text()
            self.assertIn(venue['name'], document)
            self.assertNotIn('| 행 | A |', document)
            for file in venue['files'].values():
                self.assertTrue((catalog.ROOT / file).is_file(), file)
        jw = next(v for v in data['venues'] if v['name'] == 'JW메리어트호텔')
        self.assertIsNone(jw['metrics']['mealMin'])
        self.assertTrue(jw['attachments'])

    def test_originals_remain_identical_after_document_restructuring(self):
        original = json.loads((catalog.BASE / '수집목록.json').read_text())['files']
        extra = json.loads((catalog.BASE / '추가원본_수집목록.json').read_text())['files']
        for record in original:
            if record['file'].startswith('03_참가격_업체별_공시원본/'):
                path = catalog.BASE / record['file'].split('/', 1)[1]
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), record['sha256'])
        for record in extra:
            self.assertEqual(hashlib.sha256((catalog.BASE / record['file']).read_bytes()).hexdigest(), record['sha256'])


if __name__ == '__main__':
    unittest.main()
