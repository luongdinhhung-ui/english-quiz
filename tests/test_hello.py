from test_proj import hello


def test_hello():
    assert hello() == "Hello, world!"
    assert hello("Hung") == "Hello, Hung!"
