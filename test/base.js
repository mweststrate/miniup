(function(exports, miniup, assert, fail) {

function parse(grammar, input, expected, opts) {
    var catched = false;
    var res;
    try {
        var g = miniup.Grammar.load(grammar);
        res = g.parse(input, miniup.Util.extend({debug: false, cleanAST: true}, opts || {}));
    }

    catch(e) {
        catched = true;
        if (expected && expected.fail)
            assert.equal(e.getColumn(), expected.col);
        else
            throw new assert.AssertionError({ message : "Didn't expect exception:" + e.toString()});
    }

    if (expected && expected.fail) {
        if(!catched)
            assert.ok(false, "Expected exception");
    }
    else if (expected instanceof Object && res instanceof Object) //either object or array
        assert.deepEqual(res, expected);
    else
        assert.equal(res, expected);

    return res;
}

exports.test1 = function(test) {
    assert.ok(miniup);
    test.done();
};

exports.test2 = function(test) {
    var g = miniup.GrammarReader.getMiniupGrammar();
    g.parse("x = a"); //should not fail
    test.done();
};

exports.test3 = function(test) {
    parse("x = 'x'", 'x', 'x');
    parse("x <- 'x'", 'x', 'x');
    parse("x = y:'x'", 'x', { y: 'x'});
    parse("x = 'x'", ' x', fail(1));
    parse("x = 'x'", 'X', fail(1));
    parse("x = 'x'i", 'X', "X");
    parse("x = 'x'", 'xx', fail(2));
    parse("x = 'x'", 'x x', fail(2));
    parse("x = 'x'", 'x ', fail(2));
    parse("x = 'x'+", 'xx', ["x", "x"]); //literal matcher always include word boundary!
    parse("x = 'x' '-' 'x'", 'x-x', {});

    test.done();
};

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
};

exports.readmetests = function(test) {
    parse("phone = number; number = [0-9]+;", "45", ["4", "5"]);
    parse("foo = 'baR'i", "BAr" , "BAr");
    parse("foo = [^bar]", "R" , "R");
    parse("phone = number; number = $[0-9]+;", "45", "45");

    parse("foo = 'bar' name:'baz'", "barbaz" , { name: "baz" });
    parse("foo = 'a' / 'b' / 'b' / 'c'", "b" , "b");

    parse(
        "decl = @whitespace-on modifiers:(pub:'public'? stat:'static'?) name: IDENTIFIER '(' ')'",
        "static foo()",
        { modifiers : { pub : null, stat: 'static' }, name: "foo" }
    );

    parse("abc = a:'a' 'b' c:'c'", "abc" , { a: "a", c: "c"});

    parse("abc = a:'a' 'b' c:'c'", "abc", { a: "a", c: "c", 0: "a", 1: "b", 2: "c", length: 3 }, { extendedAST : true });
    parse("foo = bar:'bar'? baz:'baz'", "baz" , { bar: null, baz: 'baz'});
    parse("foo = 'a'*", "aaaa" , ['a', 'a', 'a', 'a']);
    parse("foo = 'a'+", "aaaa" , ['a', 'a', 'a', 'a']);
    parse("foo = &'0' num:[0-9]+", "017" , { num : [ '0', '1', '7' ]});
    parse("foo = &'0' num:[0-9]+", "117" , fail(1));
    test.done();
};

exports.extensionstest = function(test) {
    parse("foo = @whitespace-on 'foo' bars:$('bar'+) 'baz'", "foo bar bar baz", { bars: "bar bar" });
    parse("foo = 'idontlike ' !'coffee' what:/[a-z]*/", "idontlike tea" , { what: "tea" });
    parse("float = /[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?/", "-34.3e523" , "-34.3e523");
    parse("args = args:(expr ',')*?; expr = 'dummy'", "dummy" , { args: ["dummy"] });
    parse("args = args:(expr ',')*?; expr = 'dummy'", "dummy,dummy,dummy" , { args: ["dummy", "dummy", "dummy"]});

    parse("modifiers = @whitespace-on (public:'public' static:'static' final: 'final')#", "final public", {public:"public", static: null, final: "final"});

    parse(
        "numbers = @whitespace-on ($number)+; number = @whitespace-off '-'? [0-9] + ('.' [0-9]+)?; whitespace = WHITESPACECHARS;",
        "42  3.16  -12",
        ["42", "3.16", "-12"]
    );

    test.done();
};

exports.errortest = function(test) {
    parse("foo = 'a'", "ab", fail(2));

    try {
        miniup.Grammar.load("foo = bar"); //bar not defined
        assert.ok(false)
    }
    catch (e) {
        assert.ok((""+e).match(/Undefined rule: 'bar'/))
    }

    try {
        miniup.Grammar.load("foo = ('a')#"); //requires two items
        assert.ok(false)
    }
    catch (e) {
        assert.ok((""+e).match(/at least two items/))
    }

    try {
        miniup.Grammar.load("foo = ('a')+?"); //requires two items
        assert.ok(false)
    }
    catch (e) {
        assert.ok((""+e).match(/at least two items/))
    }

    try {
        miniup.Grammar.load("foo = ('a')*?"); //requires two items
        assert.ok(false)
    }
    catch (e) {
        assert.ok((""+e).match(/at least two items/))
    }


    test.done();
};

exports.bugtests = function(test) {
    parse("x = n:[a-z] d:[0-9]","0a", fail(1));

    parse("x = n:[a-z] d:[0-9]","a0", { n: 'a', d: '0'});

    parse("x = ('0'?)* '1'", "1", fail(1)) //0?* is a never ending rule

    test.done();
};

exports.importtest = function(test) {
    var coffeeGrammar = miniup.Grammar.load("coffee = flavor : ('coffee' /  'cappucino')");
    miniup.Grammar.register('CoffeeGrammar', coffeeGrammar);
    var fooGrammar = miniup.Grammar.load("foo = @import CoffeeGrammar.coffee");
    var res = fooGrammar.parse("cappucino",  { cleanAST : true});
    assert.deepEqual(res, { flavor : "cappucino" });


    coffeeGrammar = miniup.Grammar.load("coffee = flavor : tea; tea = 'tea'");
    miniup.Grammar.register('CoffeeGrammar', coffeeGrammar);
    fooGrammar = miniup.Grammar.load("foo = @import CoffeeGrammar.coffee");
    res = fooGrammar.parse("tea",  { cleanAST : true});
    assert.deepEqual(res, { flavor : "tea" });

    test.done();
};

exports.leftrecursiondetection = function(test) {
    //TODO: test with leftrecursion disabled:
    parse("foo = foo 'x' / 'x'", "xxxx", fail(1))
    test.done();
};

export.leftrecursion = function(test) {
   // jake && ./miniup -v -g "x=x 'a' / 'b'" "baaaaa"

    // ./miniup -v -g "x=z 'a' / 'b';z=x" "baaaaa"

    //./miniup -g "A= A b/b;b='b'" "bbbbb"

    ./miniup -g "A=B 'x' / 'x';B=A'y'/'y'" "x"
./miniup -g "A=B 'x' / 'x';B=A'y'/'y'" "yx"
./miniup -g "A=B 'x' / 'x';B=A'y'/'y'" "xyx"
./miniup -g "A=B 'x' / 'x';B=A'y'/'y'" "yxyx"//not working yet!

}

if ((typeof(module) !== "undefined" && !module.parent) || typeof(window) !== "undefined") {
    if (typeof(runtests) !== "undefined")
        runtests(exports);
    else { //running coverage. simulating node-unit. Blegh blegh blegh fixme fixme.
        for (var key in exports)
            exports[key]({
                done : function(){ console.info("Finished test " + key);}
            });
    }

}

})(
    typeof(exports) != "undefined" ? exports : {},
    typeof(require) !== "undefined" ? require("../miniup.js") : window.miniup,
    typeof(require) !== "undefined" ? require("assert") : window.assert,
    function(column) { return { fail : true, col : column }; }
);

