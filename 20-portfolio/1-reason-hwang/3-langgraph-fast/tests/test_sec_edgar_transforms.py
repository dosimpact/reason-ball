"""Pinned official SEC transforms must be registered before Inline XBRL loading."""
import pytest
from arelle.ModelValue import qname

from infrastructure.edgar_transforms import loadSECtransforms


@pytest.mark.parametrize(('name', 'value', 'expected'), [
    ('boolballotbox', '☒', 'true'),
    ('boolballotbox', '☐', 'false'),
    ('stateprovnameen', 'Delaware', 'DE'),
    ('numwordsen', 'twenty six', '26'),
])
def test_official_sec_transforms(name, value, expected):
    transforms = {}
    loadSECtransforms(transforms)
    key = qname('http://www.sec.gov/inlineXBRL/transformation/2015-08-31', f'ixt-sec:{name}')
    assert transforms[key](value) == expected


def test_invalid_sec_transform_value_is_rejected():
    transforms = {}
    loadSECtransforms(transforms)
    key = qname('http://www.sec.gov/inlineXBRL/transformation/2015-08-31', 'ixt-sec:boolballotbox')
    with pytest.raises(NameError):
        transforms[key]('not a ballot box')
