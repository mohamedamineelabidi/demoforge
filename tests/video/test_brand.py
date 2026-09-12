import pytest

from demoforge.brand.tokens import BrandTokens


def test_neutral_tokens_have_readable_contrast():
    tokens = BrandTokens()
    assert tokens.background == "#f7f8fa"
    assert tokens.contrast_ratio() >= 4.5


@pytest.mark.parametrize("foreground", ["#f7f8fa", "url(https://evil.test/image)", "red"])
def test_low_contrast_and_nonliteral_colors_rejected(foreground):
    with pytest.raises(ValueError):
        BrandTokens(foreground=foreground)
