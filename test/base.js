(function(exports, miniup, assert, fail) {

function parse(grammar, input, expected) {
    var catched = false;

    try {
        var g = miniup.Grammar.load(grammar);
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
    assert.ok(miniup);
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
    parse("x = 'x'", 'xx', fail(2));
    parse("x = 'x'", 'x x', fail(2));
    parse("x = 'x'", 'x ', fail(2));
    parse("x = 'x'+", 'xx', ["x", "x"]); //literal matcher always include word boundary!
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

exports.readmetests = function(test) {
  //  `phone = number; number = [0-9]+;` x `45` &raquo; `"45"`
    parse("foo = 'baR'i", "BAr" , "BAr");
    parse("foo = [^bar]", "R" , "R");
    parse("foo = 'bar' name:'baz'", "barbaz" , { name: "baz" });
    parse("foo = 'a' / 'b' / 'b' / 'c'", "b" , "b");


//    decl = @whitespace-on modifiers:(pub:'public'? stat:'static'?) name: IDENTIFIER '(' ')'

//x `static foo()` &raquo; `{ modifiers : { pub : null, stat: 'static' }, name: "foo" }`

    parse("abc = a:'a' 'b' c:'c'", "abc" , { a: "a", c: "c"});

//Example (with extended AST enabled): `abc = a:'a' 'b' c:'c'` x `abc` &raquo; `{ a: "a", c: "c", 0: "a", 1: "b", 2: "c", length: 3 }`

    parse("foo = bar:'bar'? baz:'baz'", "baz" , { bar: null, baz: 'baz'});
    parse("foo = 'a'*", "aaaa" , ['a', 'a', 'a', 'a']);
    parse("foo = 'a'+", "aaaa" , ['a', 'a', 'a', 'a']);
    parse("foo = &'0' num:[0-9]+", "017" , { num : [ '0', '1', '7' ]});
    parse("foo = &'0' num:[0-9]+", "117" , fail(1));
    test.done();
}

exports.extensionstest = function(test) {
    parse("foo = 'idontlike ' !'coffee' what:/[a-z]*/", "idontlike tea" , { what: "tea" });
    parse("float = /[-+]?[0-9]*\\.?[0-9]+([eE][-+]?[0-9]+)?/", "-34.3e523" , "-34.3e523");
    parse("args = args:(expr ',')*?; expr = 'dummy'", "dummy" , { args: ["dummy"] });
    parse("args = args:(expr ',')*?; expr = 'dummy'", "dummy,dummy,dummy" , { args: ["dummy", "dummy", "dummy"]});

//`modifiers = (public:'public' static:'static' final: 'final')#` x `final public` &raquo; `{public:"public", static: null, final: "final"}`

//numbers = @whitespace-on number+; number = @whitespace-off '-'? [0-9] + ('.' [0-9]+)?; whitespace = WHITESPACECHARS ` x `42  3.16  -12` &raquo; `["42", "3.16", "-12"]`

    test.done();
}

exports.importtest = function(test) {
//var coffeeGrammar = miniup.Grammar.load("coffee = flavor : ('coffee' /  'cappucino')");
  //  miniup.Grammar.register('CoffeeGrammar', coffeeGrammar);
   // var fooGrammar = miniup.Grammar.load("foo = @import CoffeeGrammar.coffee");
    //fooGrammar.parse("cappucino");
    //returns: { flavor : "cappucino" }

    test.done();
}

exports.leftrecursiondetection = function(test) {
    //TODO: test with leftrecursion disabled:
    // parse("foo = foo 'x' / 'x'", "xxxx", fail(1))
    test.done();
}

if ((typeof(module) !== "undefined" && !module.parent) || typeof(window) !== "undefined") {
    if (typeof(runtests) !== "undefined")
        runtests(exports);
    else { //running coverage. simulating node-unit. Blegh blegh blegh fixme fixme.
        for (var key in exports)
            exports[key]({ done : function(){ console.info("Finished test " + key)}});
    }

}

})(
    typeof(exports) != "undefined" ? exports : {},
    typeof(require) !== "undefined" ? require("../miniup.js") : window.miniup,
    typeof(require) !== "undefined" ? require("assert") : window.assert,
    function(column) { return { fail : true, col : column } }
)

