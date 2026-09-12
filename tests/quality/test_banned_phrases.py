from demoforge.quality.banned_phrases import Violation, lint_copy


def test_detects_banned_phrase_and_em_dash():
    violations = lint_copy("Supercharge your agents — now")
    kinds = sorted(v.kind for v in violations)
    assert kinds == ["em_dash", "phrase"]
    assert any(v.match.lower() == "supercharge" for v in violations)


def test_clean_copy_has_no_violations():
    assert lint_copy("Build agents faster. Debug with visibility.") == []


def test_word_boundaries_avoid_false_positives():
    # "delve" is banned, "delivered" is not
    assert lint_copy("Delivered in one command.") == []


def test_violation_reports_position():
    v = lint_copy("A seamless flow")[0]
    assert isinstance(v, Violation)
    assert v.start == 2 and v.end == 10
