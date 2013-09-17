(function(exports, miniup, assert, fail) {

function parse(grammar, input, expected) {
    var g = miniup.Grammar.load(grammar);
    var catched = false;

    try {
        var res = g.parse(input, {debug: false, cleanAST: true});
    }

    catch(e) {
        catched = true;
        if (expected && expected.fail)
            assert.equal(e.getColumn(), expected.col);
        else
            throw new assert.AssertionError({ message : "Didn't expect exception:" + e.toString()})
    }

    if (expected && expected.fail) {
        if(!catched)
            assert.ok(false, "Expected exception")
    }
    else if (expected instanceof Object && res instanceof Object) //either object or array
        assert.deepEqual(res, expected);
    else
        assert.equal(res, expected);

    return res;
}

exports.test1 = function(test) {
    test.ok(miniup);
    test.done();
};

exports.test2 = function(test) {
    var g = miniup.GrammarReader.getMiniupGrammar();
    g.parse("x = a") //should not fail
    test.done();
};

exports.test3 = function(test) {
    parse("x = 'x'", 'x', 'x');
    parse("x = y:'x'", 'x', { y: 'x'});
    parse("x = 'x'", ' x', fail(1));
    parse("x = 'x'", 'X', fail(1));
    parse("x = 'x'i", 'X', "X");
    parse("x = 'x'", 'xx', fail(1)); //literal matcher always include word boundary!
    parse("x = 'x'", 'x x', fail(2));
    parse("x = 'x'", 'x ', fail(2));
    parse("x = 'x'+", 'xx', fail(1)); //literal matcher always include word boundary!
    parse("x = 'x' '-' 'x'", 'x-x', {});

    test.done();
}

exports.testwhitespace = function(test) {
    parse("x = @whitespace-on 'x'; whitespace = WHITESPACECHARS", ' x ', "x");
    parse("x = @whitespace-on 'x'; whitespace = '.'+", '..x.', "x");
    parse("x = @whitespace-on 'x'", '\t\t\ty ', fail(4));
    parse("x = @whitespace-on 'x'+", 'x x', ['x', 'x']);
    parse("x = @whitespace-on 'x'; whitespace = '.'+", '..x.', "x");
    parse("x = @whitespace-on ('x' / y)+; y = @whitespace-off '-' '7'", ' x  -7 x x -7', [ 'x', {}, 'x', 'x', {} ] );
    parse("x = @whitespace-on ('x' / y)+; y = @whitespace-off '-' '7'", ' x  -7 x x -7-7 x', [ 'x', {}, 'x', 'x', {},{},"x" ] );
    parse("x = @whitespace-on ('x' / y)+; y = @whitespace-off '-' '7'", ' x - 7 x', fail(5));

    test.done();
}


if ((typeof(module) !== "undefined" && !module.parent) || typeof(window) !== "undefined")
    runtests(exports);

})(
    typeof(exports) != "undefined" ? exports : {},
    typeof(require) !== "undefined" ? require("../miniup.js") : window.miniup,
    typeof(require) !== "undefined" ? require("assert") : window.assert,
    function(col) { return { fail : true, col : col } }
)

