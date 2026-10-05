import unittest

from budget_ingest import budget_totals, number, parse_document


class BudgetIngestTests(unittest.TestCase):
    def test_number_handles_swedish_budget_format(self):
        self.assertEqual(number("−1\u00a0289"), -1289)
        self.assertEqual(number("±0"), 0)
        self.assertIsNone(number(".."))

    def test_parses_government_and_party_deviation(self):
        body = "".join(
            f"<tr><td>{i}</td><td>Område {i}</td><td>1 000</td><td>−10</td><td>20</td></tr>"
            for i in range(1, 28)
        )
        html = ("<p>Regeringens och motionärernas förslag till utgiftsramar 2026</p>"
                "<table><tr><td></td><td></td><td>förslag</td><td>S</td><td>V</td></tr>"
                + body + "</table>")
        rows = parse_document(html, "2025/26", "HD01FiU1", "https://example.test")
        self.assertEqual(len(rows), 81)
        social_democrats = next(row for row in rows if row["actor"] == "S" and row["expenditure_area"] == 1)
        self.assertEqual(social_democrats["amount_msek"], 990)
        self.assertEqual(social_democrats["deviation_msek"], -10)


    def test_reads_the_budget_year_not_the_later_years(self):
        # FiU1 also tabulates the two following years; the last table must not win.
        def table(year, value):
            rows = "".join(f"<tr><td>{i}</td><td>Område {i}</td><td>{value}</td><td>1</td></tr>"
                           for i in range(1, 28))
            return (f"<p>Regeringens och motionärernas förslag till utgiftsramar {year}</p>"
                    f"<table><tr><td></td><td></td><td>förslag</td><td>S</td></tr>{rows}</table>")
        html = table(2026, "100") + table(2027, "200") + table(2028, "300")
        rows = parse_document(html, "2025/26", "HD01FiU1", "https://example.test")
        self.assertEqual({row["government_amount_msek"] for row in rows}, {100})

    def test_joins_a_table_split_by_a_page_break_and_repairs_split_figures(self):
        head = "<table><tr><td></td><td></td><td>förslag</td><td>M</td><td></td><td>SD</td></tr>"
        first = "".join(f"<tr><td>{i}</td><td>Område {i}</td><td>1 000</td><td>−10</td><td>20</td></tr>"
                        for i in range(1, 25))
        # A figure broken over two cells, and an empty extra cell.
        first += "<tr><td>4b</td></tr>"
        first = first.replace("<tr><td>3</td><td>Område 3</td><td>1 000</td><td>−10</td><td>20</td></tr>",
                              "<tr><td>3</td><td>Område 3</td><td>1 000</td><td>+4</td><td>769</td><td>20</td></tr>")
        first = first.replace("<tr><td>5</td><td>Område 5</td><td>1 000</td><td>−10</td><td>20</td></tr>",
                              "<tr><td>5</td><td>Område 5</td><td>1 000</td><td>−10</td><td></td><td>20</td></tr>")
        rest = "".join(f"<tr><td></td><td>{i}</td><td>Område {i}</td><td>1 000</td><td>−10</td><td>20</td></tr>"
                       for i in range(25, 28))
        total = "<tr><td></td><td>Summa utgiftsområden</td><td>27 000</td><td>4 509</td><td>540</td></tr>"
        html = ("<p>Regeringens och motionärernas förslag till utgiftsramar 2019</p>" + head + first
                + "</table><p>60</p><table><tr><td>Sidhuvud</td></tr>" + rest + total + "</table>"
                + "<p>Källor: budgetpropositionen</p>")
        rows = parse_document(html, "2018/19", "H601FiU1", "https://example.test")
        self.assertEqual(len({row["expenditure_area"] for row in rows}), 27)
        moderates = {row["expenditure_area"]: row["deviation_msek"] for row in rows if row["actor"] == "M"}
        sweden_democrats = {row["expenditure_area"]: row["deviation_msek"] for row in rows if row["actor"] == "SD"}
        self.assertEqual(moderates[3], 4769)
        self.assertEqual(sweden_democrats[5], 20)
        self.assertEqual(budget_totals(html, "2018/19"), {"GOV": 27000, "M": 4509, "SD": 540})

    def test_refuses_a_year_that_does_not_add_up_to_the_printed_total(self):
        rows = "".join(f"<tr><td>{i}</td><td>Område {i}</td><td>1 000</td><td>−10</td></tr>"
                       for i in range(1, 28))
        html = ("<p>Regeringens och motionärernas förslag till utgiftsramar 2026</p>"
                "<table><tr><td></td><td></td><td>förslag</td><td>S</td></tr>" + rows
                + "<tr><td>Summa utgiftsområden</td><td></td><td>27 000</td><td>−900</td></tr></table>")
        with self.assertRaisesRegex(ValueError, "summerar"):
            parse_document(html, "2025/26", "HD01FiU1", "https://example.test")


if __name__ == "__main__":
    unittest.main()
