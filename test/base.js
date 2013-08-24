(function(exports, miniup) {

function parse(grammar, input) {
    var g = miniup.Grammar.load(grammar);
    return g.parse(input);
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
    parse("x = 'x'", x);
    test.done();
}


//if ((typeof(module) !== "undefined" && !module.parent) || typeof(window) !== "undefined")
 //   NOA.Util.runtests(exports);

})(typeof(exports) != "undefined" ?exports : (t1 = {}), typeof(require) !== "undefined" ? require("../miniup.js") : window.miniup);

