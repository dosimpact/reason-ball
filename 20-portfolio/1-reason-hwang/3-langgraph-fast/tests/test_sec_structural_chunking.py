import pytest
import tiktoken

from domains.sec_modeling.chunking import chunk_html


def test_document_order_and_table_context():
    html = "<div><p>Before the table.</p><p>Revenue in USD millions</p><table><tr><td>Year</td><td>2025</td></tr><tr><td>Product</td><td>Revenue</td></tr><tr><td>Goods</td><td>26,312</td></tr></table><p>After the table.</p></div>"
    chunks = chunk_html(html)
    assert chunks[0].startswith("Before the table.")
    assert "Revenue in USD millions\nYear\t2025" in chunks[1]
    assert "Goods\t26,312" in chunks[1]
    assert chunks[-1] == "After the table."


def test_split_table_repeats_heading_without_losing_rows():
    rows = "".join(
        f"<tr><td>Product {i}</td><td>{i * 100}</td></tr>" for i in range(80)
    )
    chunks = chunk_html(
        "<p>USD millions</p><table><tr><td>Year 2025</td></tr><tr><td>Product Revenue</td></tr>"
        + rows
        + "</table>",
        maximum=120,
    )
    tables = chunks[1:]
    assert len(tables) > 1
    assert all("Year 2025\nProduct Revenue" in c for c in tables)
    assert all(f"Product {i}\t{i * 100}" in "\n".join(tables) for i in range(80))


def test_long_sentence_preserves_unicode_words_and_limit():
    words = [f"한글단어{i}" for i in range(300)]
    chunks = chunk_html("<p>" + " ".join(words) + "</p>", maximum=120)
    assert " ".join(chunks).split() == words
    encoder = tiktoken.get_encoding("cl100k_base")
    assert all(len(encoder.encode(c)) <= 120 for c in chunks)


def test_table_oversized_row_fails_instead_of_truncating():
    with pytest.raises(ValueError, match="Table row"):
        chunk_html(
            "<table><tr><td>Header</td></tr><tr><td>USD</td></tr><tr><td>"
            + "revenue " * 200
            + "</td></tr></table>",
            maximum=120,
        )


def test_no_double_extraction_of_nested_inline_text():
    assert chunk_html(
        "<div><p>A <b>bold</b> statement.</p><div>Another <span>value</span>.</div></div>"
    ) == ["A bold statement. Another value."]


def test_inline_span_whitespace_and_trademark_are_preserved():
    assert chunk_html(
        "<p><span>iPhone</span><sup>®</sup><span> is a smartphone.</span></p>"
    ) == ["iPhone® is a smartphone."]
    assert chunk_html("<p><span> Revenue </span><span>rose </span>again.</p>") == [
        "Revenue rose again."
    ]


def test_inline_line_break_preserves_word_boundary():
    assert chunk_html("<p>Product<br/>revenue</p>") == ["Product revenue"]
