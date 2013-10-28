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
            throw new Error("Didn't expect exception:" + e.toString());
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



exports.test4 = function(test) {
    parse("x = a a <- 'b'", "b", "b"); //rule not separated by semicolon

    parse("x = .", "b", "b");
    parse("x = .", "bb", fail(2));
    parse("x = .", "", fail(1));

    parse("x 'friendlyname' = 'b'", "b", "b")

    parse("x 'frienlyname' = a a 'friendlyname2' <- 'b'", "b", "b"); //rule not separated by semicolon

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
};

exports.testsemanticaction = function(test) {
    parse("x = {{{sdf}}} 'a'", "a", "a");
    test.done();
}

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
    parse("args = args:(expr ; ',')*; expr = 'dummy'", "dummy" , { args: ["dummy"] });
    parse("args = args:(expr ; ',')*; expr = 'dummy'", "dummy,dummy,dummy" , { args: ["dummy", "dummy", "dummy"]});

    parse("x=('a' 'b'; 'c' 'd')+", "abcdabcdab",[{},{},{}])

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

    test.done();
};

exports.bugtests = function(test) {
    parse("x = INTEGER", 7, "7");

    parse("x = n:[a-z] d:[0-9]","0a", fail(1));

    parse("x = n:[a-z] d:[0-9]","a0", { n: 'a', d: '0'});

    parse("x= ('a'; 'b')+", "ababa", ["a","a","a"]);
    parse("x= ('a'; 'b')+", "abab", fail(5));

    parse("x = l:('0'?)* r:'1'", "1", { l: [ null ], r:"1"}) //0?* is a never ending rule

    parse("A = '7'", 7, "7");

    parse('x=[[]', "[", "[");
    parse('x=[*\\\\/[]+', "[*/\\", ["[","*","/","\\"]);

    parse('x=.', '\n', '\n');

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
    //left recusion detection
    parse("foo = foo 'x' / 'x'", "xxxx", fail(1), { allowLeftRecursion : false })

    //right recursion detetion: A = 'x'? A | 'y'
    parse("A = 'x'? A / 'y'", "yyy", fail(1), { allowLeftRecursion : false })

    test.done();
};

exports.lambdatest = function(test) {
    parse("x =  l:'a' r:x / - ", 'aaa', { l: 'a', r: { l : 'a', r : { l : 'a', r : null}}});
    parse("x =  l:'a' r:x / ", 'aaa', { l: 'a', r: { l : 'a', r : { l : 'a', r : null}}});

    parse("x = ('a'; 'b'?)*", "", [])
    parse("x = ('a'; 'b'?)*", "abaaa", ["a", "a", "a", "a"])
    parse("x = ('a'; 'b'?)*", "abaaab", fail(7)) //'cause separator was found
    parse("x = ('a'; 'b'?)*", "ababa", ["a", "a", "a"])

    parse("x = ('a'?; 'b')+", "", [null]) //might seem weird, but 'a'? matches nothing, so one iteration does succeed
    parse("x = ('n'?; 'b')+", "nbbnb", ["n", null, "n",null])
    parse("x = ('a'? 'b')+", "abbab", [{},{},{}]) //3 succesful iteratinos
    parse("x = ('a'?; 'b')+", "bbb", [null,null,null,null])
    parse("x = ('a'?; 'b')+", "ababa", ["a", "a", "a"])
    parse("x = ('a'? 'b')+", "ababa", fail(6))

    parse("x = ('a'?; 'b'?)*", "", [null, null]) //MWE: disputable, but strange case
    parse("x = ('a'?; 'b'?)*", "aaa", ["a", "a", "a", null])
    parse("x = ('a'?; 'b'?)*", "bbb", [null,null,null,null,null])
    parse("x = ('a'? ;'b'?)*", "bbaabb", [null,null,"a", "a", null,null, null])

    test.done();
}

exports.operators = function(test) {
    parse("x = '+' > INTEGER", "", fail(1));
    parse("x = '+' > INTEGER", "1", "1");
    parse("x = '+' > INTEGER", "1+2", { left: "1", op:"+", right: "2" });
    parse("x = '+' > INTEGER", "1+2+3", { left: { left: "1", op:"+", right: "2" }, op:"+", right: "3"});
    parse("x = '+' @left > INTEGER", "1+2+3", { left: { left: "1", op:"+", right: "2" }, op:"+", right: "3"});
    parse("x = '+' @right > INTEGER", "1+2+3", { left: "1", op:"+", right: { left: "2", op: "+", right: "3"}});

    //multiple operatores.
    parse("x = '*' > '+' > INTEGER", "1+2+3", { left: { left: "1", op:"+", right: "2" }, op:"+", right: "3"});
    parse("x = '*' > '+' > INTEGER", "1*2*3", { left: { left: "1", op:"*", right: "2" }, op:"*", right: "3"});
    parse("x = '*' > '+' > INTEGER", "1*2+3", { left: { left: "1", op:"*", right: "2" }, op:"+", right: "3"});
    parse("x = '*' > '+' > INTEGER", "1+2*3", { left: "1", op: "+", right:{ left: "2", op:"*", right: "3" }});

    //should work without left recursion suppiort
    parse("x = '*' > '+' > INTEGER", "1+2*3", { left: "1", op: "+", right:{ left: "2", op:"*", right: "3" }}, { allowLeftRecursion : false });

    parse("x = '*' @left > '+' @right > INTEGER", "1+2*3*4+5+6+7*8",
        {
            left : "1",
            op : "+",
            right : {
                left : {
                    left : {
                        left : "2",
                        op : "*",
                        right : "3"
                    },
                    op: "*",
                    right : "4"
                },
                op:"+",
                right: {
                    left: "5",
                    op: "+",
                    right: {
                        left: "6",
                        op: "+",
                        right: {
                            left: "7",
                            op: "*",
                            right: "8"
                        }
                    }
                }
            }
        });

    parse("x = '*' > '+' > prim; prim = '(' x ')' / INTEGER", "7", "7");
    parse("x = '*' > '+' > prim; prim = '(' v:x ')' / INTEGER", "(7)", {v:'7'});
    parse("x = '*' > '+' > prim; prim = '(' v:x ')' / INTEGER", "(1+2)*3", { left: { v: { left: "1", op:"+", right: "2"}}, op: "*", right: "3"});
    parse("x = '*' > '+' > prim; prim = '(' v:x ')' / INTEGER", "1+(2+3)", { left: "1", op:"+", right: { v: { left: "2", op: "+", right: "3"}}});
    parse("x = '*' > '+' > prim; prim = '(' v:x ')' / INTEGER", "1*(2+3)", { left: "1", op:"*", right: { v: { left: "2", op: "+", right: "3"}}});

    test.done();
}

exports.improvecoverage = function(test) {
    parse("x = @whitespace-on 'function' 'stuff'", "function stuff", {});
    parse("x = @whitespace-on 'function' 'stuff'", "functionstuff", fail(1));
    parse("x = @whitespace-on 'function' '.' 'stuff'", "function . stuff", {});
    parse("x = @whitespace-on 'function' '.' 'stuff'", "function.stuff", {});
    parse("x = @whitespace-on 'function' '.' 'stuff'", "function. stuff", {}, { debug: true});

    assert.throws(function() { miniup.Grammar.get("nonsense"); });

    parse("x = (l: 'a' 'b')#", "ba", { l: "a"})
    parse("x = (l: 'a' 'b')#", "ba", { l: "a"}, { debug : true})

    parse(
        "x = l: 'a' 'b'",
        "ab",
        { l: "a", $rule : "x", $start : 0, $text: "ab"},
        { cleanAST : false}
    )

    parse(
        "x = l: 'a' 'b'", "ab",
        { l: "a", $rule : "x", $start : 0, $text: "ab", 0: "a", 1:"b", length: 2},
        { cleanAST : false, extendedAST : true}
    )

    try {
        miniup.Grammar.load("x='a'").parse("b");
        assert.ok(false);
    }
    catch (e){
        assert.equal(e.toString(), "Miniup.ParseException: input(1,1): Unexpected end of input\nb\n^\nExpected 'a'")
        assert.equal(e.getLineNr(), 1)
    }

    test.done();
}

exports.testunicode = function(test) {
    var g = miniup.Grammar.load("x = SINGLEQUOTESTRING")
    assert.equal(miniup.RegExpUtil.unescapeQuotedString(g.parse("'a'")), "a");
    assert.equal(miniup.RegExpUtil.unescapeQuotedString(g.parse("'a\na'")), "a\na");
    assert.equal(miniup.RegExpUtil.unescapeQuotedString(g.parse("'a\ta'")), "a\ta");
    assert.equal(miniup.RegExpUtil.unescapeQuotedString(g.parse("'a\u1234a'")), "aሴa");
    assert.equal(miniup.RegExpUtil.unescapeQuotedString(g.parse("'a\xFFa'")), "aÿa");
    assert.equal(miniup.RegExpUtil.unescapeQuotedString(g.parse("'a\077a'")), "a?a");

    test.done();
}

exports.testgrammarmodification = function(test) {
    var g = miniup.Grammar.load("x = '3'");

    assert.throws(function() { g.addRule(miniup.MatcherFactory.dot()); }, /Anonymous rules cannot be registered in a grammar/);
    assert.throws(function() { g.addRule("x", miniup.MatcherFactory.dot()); }, /is already defined/);

    var h = g.clone();
    assert.equal(g.parse("3"), "3");

    g.updateRule("x", miniup.MatcherFactory.dot());
    assert.equal(g.parse("4"), "4");

    assert.throws(function() { h.parse("4") });
    assert.equal(h.parse("3"), "3");

    assert.throws(function() { g.parse("45") }, /<nothing>/)



    var temp = miniup.Grammar.load("x = y y = 'z'+")

    g.updateRule("x", temp.rule("x"));
    g.addRule("y", temp.rule("y"))

    assert.equal(g.parse("zzzz").join(""), "zzzz");

    test.done();
}

exports.testdefaultlabel = function(test) {
    assert.throws(function() { parse( "x = a:'a' ::'b'", "ab","");}, /default label/);
    parse("x = 'a' ::'b'", "ab", "b");
    parse("x = 'a' ::(x:'b')", "ab", {x:'b'});
    test.done();
}

exports.leftrecursion = function(test) {
    parse("x=x 'a' / 'b'", "baaaaa", {})
    parse("x=z 'a' / 'b';z=x","baaaaa", {});

    parse("A= A b/b;b='b'", "bbbbb", {});
    parse("A=B 'x' / 'x';B=A'y'/'y'", "x", "x");
    parse("A=B 'x' / 'x';B=A'y'/'y'", "yx", {});
    parse("A=B 'x' / 'x';B=A'y'/'y'", "xyx", {});
    //Correct, but known one to fail... parse("A=B 'x' / 'x';B=A'y'/'y'", "yxyx", {});
    test.done();
}

exports.leftrecursionwithAST = function(test) {
    //For left recursive rules, the AST is nice...
    parse("x=a:x b:'b' / c:'a'", "abb", { a: { a: { c: 'a' }, b: 'b' }, b: 'b' });

    parse("x=a:x b:'b' / c:'a'", "abb", {
        a: {
            a: {
                c: 'a',
                '$start': 0,
                '$text': 'a',
                '$rule': 'x'
            },
            b: 'b',
            '$start': 0,
            '$text': 'ab',
            '$rule': 'x'
        },
        b: 'b',
        '$start': 0,
        '$text': 'abb',
        '$rule': 'x'
    }, { cleanAST : false});

    parse("x=a:x b:'b' / c:'a'", "abb", {
        '0': {
            '0': { '0': 'a', c: 'a', length: 1 },
            '1': 'b',
            a  : { '0': 'a', c: 'a', length: 1 },
            length: 2,
            b: 'b'
        },
        '1': 'b',
        a: {
            '0': { '0': 'a', c: 'a', length: 1 },
            '1': 'b',
            a:   { '0': 'a', c: 'a', length: 1 },
            length: 2,
            b: 'b'
        },
        length: 2,
        b: 'b'
    }, { extendedAST : true });

    //...Except, when a left recursive rule is right recursive as well! Do use operators in such a case!
    //The following results are parsable, but the ast is unusable in relation to the mathetmatical properties of
    //these expression
    parse("expr = l:expr o:'*' r:expr / l:expr o:'+' r:expr / 'x'", "x*x+x", { l: 'x', o: '*', r: { l: 'x', o: '+', r: 'x' } });
    parse("expr = l:expr o:'*' r:expr / l:expr o:'+' r:expr / 'x'", "x+x*x", { l: 'x', o: '+', r: { l: 'x', o: '*', r: 'x' } });
    parse("expr = l:expr o:'+' r:expr / l:expr o:'*' r:expr / 'x'", "x*x+x", { l: 'x', o: '*', r: { l: 'x', o: '+', r: 'x' } });

    //but, this grammar is useful!
    var g =
        "Expr <- Product / Sum / Value; "+
        "Value <- [0-9]+ / '(' Expr ')';"+
        "Product <- Expr (('*' / '/') Expr);"+
        "Sum <- Expr (('+' / '-') Expr)*";

    parse(g, "7","7");
    parse(g, "7+7",{});
    parse(g, "7*6+5*4",{});
    parse(g, "7*(6+5)", {});

    test.done();
}

exports.testerrorreporting = function (test) {
    function testErrors(grammar, input, pos, length, expected) {
        try {
            miniup.Grammar.load(grammar).parse(input);
        } catch(e) {
            assert.ok(e instanceof miniup.ParseException, "Expected exception");
            assert.equal(e.getColumn(), pos, "Error pos is wrong");
            assert.equal(e.coords.length, length, "Error length is wrong");
            assert.deepEqual(e.expected, expected);
            return;
        }
        assert.ok(false, "expected exception");
    }

    testErrors("x=[ab]+",  "abca", 3, 1, ["[ab]"]);
    testErrors("number = [-]? [0-9]+ ([.][0-9]+)?", "1.a", 3,1,["[0-9]"]);
    testErrors("x=(/ab/)+", "abaca", 3,1,["/ab/"]);
    testErrors("x=z+;z 'ding' = /ab/", "abaca", 3,1,["ding"])
    testErrors("x=z+;z = [a][b]", "abaca", 4,1,["[b]"]);
    testErrors("x=z+;z 'ding' = [a][b]", "abaca", 3,2,["ding"]);
    testErrors("x = number / 'abc'; number 'number' = [-]? [0-9]+ ([.][0-9]+)?", "1.asef", 1, 3, ["number"]);

    test.done();
}

exports.testshortAPI = function(test) {
    var g = miniup("x='3'");
    assert.equal(g.parse("3"), "3");

    assert.equal(miniup("x='4'", "4"), "4");
    test.done();
}

exports.impossible = function(test) {

    parse("A = 'x' A 'x' / 'x'", "x", "x")
    parse("A = a:'x' b:A c:'x' / 'x'", "xxx", {a:"x" ,b: "x", c: "x"})

    //xxxxx
    //xAx
    // xAx
    //  xAx //this will no fail the others due to backtracking. Should have chosen just 'x' for this one, but cant do that without lookahead or backtracking!
    parse("A = 'x' A 'x' / 'x'", "xxxxx", fail(6)) //This one actually valid!
    //but left descendent parsers without backtracking cannot handle this pattern:


    test.done();
}

if ((typeof(module) !== "undefined" && !module.parent) || typeof(window) !== "undefined") {
    if (typeof(runtests) !== "undefined")
        runtests(exports);
    else { //running coverage. simulating node-unit. Blegh blegh blegh fixme fixme.
        for (var key in exports) {
            try {
                exports[key]({
                   done : function(){ console.info("Finished test " + key);}
                });
            } catch(e) {
                console.error(e);
            }
        }
    }

}

})(
    typeof(exports) != "undefined" ? exports : {},
    typeof(require) !== "undefined" ? require("../miniup.js") : window.miniup,
    typeof(require) !== "undefined" ? require("assert") : window.assert,
    function(column) { return { fail : true, col : column }; }
);

