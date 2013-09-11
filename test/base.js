(function(exports, miniup, assert, fail) {

function parse(grammar, input, expected) {
    var g = miniup.Grammar.load(grammar);
    try {
        var res = g.parse(input, {debug: false, cleanAST: true});
        if (expected && expected.fail)
            assert.ok(false, "Expected exception")
        if (expected instanceof Object && res instanceof Object) //either object or array
            assert.deepEqual(res, expected);
        else
            assert.equal(res, expected);
        return res;
    }
    catch(e) {
        if (expected && expected.fail)
            assert.equals(e.getColumn(), expected.col);
        else
            throw new assert.AssertionError({ message : "Didn't expect exception:" + e.toString()})
    }
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
    parse("x = 'x'", ' x', '');
    parse("x = 'x'", 'xx', fail(2));
    parse("x = 'x'", 'x ', fail(2));
    parse("x = @whitespace-on 'x'", ' x ', 'x');
    parse("x = 'x'+", 'xx', fail(2)); //literal matcher always include word boundary!
    parse("x = @whitespace-on 'x'+", 'x x', ['x', 'x']);
    parse("x = 'x' '-' 'x', 'x-x'", ['x', '-', 'x']);

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

