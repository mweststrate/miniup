var miniup;
(function (miniup) {
    var ParseFunction = (function () {
        function ParseFunction(asString, parse, opts) {
            this.asString = asString;
            this.parse = parse;
            this.isKeyword = false;
            this.isCharacterClass = false;
            this.isTerminal = false;
            if(opts) {
                Util.extend(this, opts);
            }
        }
        ParseFunction.prototype.toString = function () {
            return this.ruleName ? this.ruleName : (this.label ? this.label + ":" : "") + this.asString;
        };
        return ParseFunction;
    })();
    miniup.ParseFunction = ParseFunction;    
    var MatcherFactory = (function () {
        function MatcherFactory() { }
        MatcherFactory.regex = function regex(regex, ignoreCase) {
            if (typeof ignoreCase === "undefined") { ignoreCase = false; }
            var r = new RegExp("^" + regex.source, ignoreCase ? "i" : "");
            return new ParseFunction("/" + regex.source + "/", function (parser) {
                var match = parser.getRemainingInput().match(r);
                if(match) {
                    parser.currentPos += match[0].length;
                    return match[0];
                }
                return undefined;
            }, {
                isTerminal: true
            });
        };
        MatcherFactory.characterClass = function characterClass(regexstr, ignoreCase) {
            if (typeof ignoreCase === "undefined") { ignoreCase = false; }
            var re = MatcherFactory.regex(new RegExp(regexstr), ignoreCase);
            return new ParseFunction(regexstr, function (p) {
                return p.parse(re);
            }, {
                isCharacterClass: true,
                isTerminal: true
            });
        };
        MatcherFactory.literal = function literal(keyword, ignoreCase) {
            if (typeof ignoreCase === "undefined") { ignoreCase = false; }
            var re = MatcherFactory.regex(new RegExp(RegExpUtil.quoteRegExp(keyword)), ignoreCase);
            return new ParseFunction(keyword, function (p) {
                return p.parse(re);
            }, {
                isKeyword: true,
                isTerminal: true
            });
        };
        MatcherFactory.dot = function dot() {
            var re = MatcherFactory.regex(/^./, false);
            return new ParseFunction(".", function (p) {
                return p.parse(re);
            }, {
                isCharacterClass: true,
                isTerminal: true
            });
        };
        MatcherFactory.rule = function rule(ruleName) {
            return new ParseFunction(ruleName, function (p) {
                return p.parse(p.grammar.rule(ruleName));
            });
        };
        MatcherFactory.zeroOrMore = function zeroOrMore(matcher) {
            return new ParseFunction(matcher.toString() + "*", function (parser) {
                var res = [];
                var item;
                do {
                    item = parser.parse(matcher);
                    if(item !== undefined) {
                        res.push(item);
                    }
                }while(item !== undefined);
                return res;
            });
        };
        MatcherFactory.oneOrMore = function oneOrMore(matcher) {
            var zmm = MatcherFactory.zeroOrMore(matcher);
            return new ParseFunction(matcher.toString() + "+", function (parser) {
                var res = parser.parse(zmm);
                return res.length > 0 ? res : undefined;
            });
        };
        MatcherFactory.optional = function optional(matcher) {
            return new ParseFunction(matcher.toString() + "?", function (parser) {
                var res = parser.parse(matcher);
                return res === undefined ? null : res;
            });
        };
        MatcherFactory.sequence = function sequence() {
            var items = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                items[_i] = arguments[_i + 0];
            }
            if(items.length == 1 && !items[0].ruleName) {
                return items[0];
            }
            return new ParseFunction("(" + items.map(function (i) {
                return i.toString();
            }).join(" ") + ")", function (parser) {
                var result = [];
                var success = items.every(function (item) {
                    var itemres = parser.parse(item);
                    if(itemres === undefined) {
                        return false;
                    }
                    if(item.isKeyword && !item.friendlyName && items.length > 1) {
                        return true;
                    }
                    result.push(itemres);
                    if(item.label) {
                        result[item.label] = itemres;
                    }
                    return true;
                });
                return success ? result.length == 1 ? result[0] : result : undefined;
            });
        };
        MatcherFactory.choice = function choice() {
            var choices = [];
            for (var _i = 0; _i < (arguments.length - 0); _i++) {
                choices[_i] = arguments[_i + 0];
            }
            return new ParseFunction("(" + choices.map(function (x) {
                return x.toString();
            }).join(" | ") + ")", function (parser) {
                var res;
                if(choices.some(function (choice) {
                    return undefined !== (res = parser.parse(choice));
                })) {
                    return res;
                }
                return undefined;
            });
        };
        MatcherFactory.positiveLookAhead = function positiveLookAhead(predicate) {
            return new ParseFunction("&" + predicate.toString(), function (parser) {
                var prepos = parser.currentPos;
                var matches = undefined !== parser.parse(predicate);
                parser.currentPos = prepos;
                return matches ? null : undefined;
            });
        };
        MatcherFactory.negativeLookAhead = function negativeLookAhead(predicate) {
            var ppm = MatcherFactory.positiveLookAhead(predicate);
            return new ParseFunction("!" + predicate.toString(), function (parser) {
                return parser.parse(ppm) === undefined ? null : undefined;
            });
        };
        MatcherFactory.named = function named(name, matcher) {
            matcher.ruleName = name;
            return matcher;
        };
        MatcherFactory.labeled = function labeled(label, matcher) {
            matcher.label = label;
            return matcher;
        };
        return MatcherFactory;
    })();
    miniup.MatcherFactory = MatcherFactory;    
    var Grammar = (function () {
        function Grammar() {
            this.rules = {
            };
        }
        Grammar.load = function load(grammarSource) {
            var ast = GrammarReader.bootstrap().parse(grammarSource);
            return GrammarReader.buildGrammar(ast);
        };
        Grammar.loadFromFile = function loadFromFile(filename) {
            return null;
        };
        Grammar.loadFromXHR = function loadFromXHR(filename, jQuery, callback) {
        };
        Grammar.prototype.test = function (input, expected) {
            return this;
        };
        Grammar.prototype.addRule = function (arg1, arg2, replace) {
            if (typeof replace === "undefined") { replace = false; }
            var rule = arg2 ? MatcherFactory.named(arg1, arg2) : arg1;
            if(!rule.ruleName) {
                throw new Error("Anonymous rules cannot be registered in a grammar. ");
            }
            if(!replace && this.rules[rule.ruleName]) {
                throw new Error("Rule '" + rule.ruleName + "' is already defined");
            }
            if("whitespace" == rule.ruleName) {
                this.whitespaceMatcher = rule;
            }
            if(this.startSymbol == null) {
                this.startSymbol = rule.ruleName;
            }
            this.rules[rule.ruleName] = rule;
            return rule;
        };
        Grammar.prototype.rule = function (ruleName) {
            if(!this.rules[ruleName]) {
                throw new Error("Rule '" + ruleName + "' is not defined");
            }
            return this.rules[ruleName];
        };
        Grammar.prototype.parse = function (input, opts) {
            if (typeof opts === "undefined") { opts = {
            }; }
            return new Parser(this, input).parseInput(this.rule(opts.startSymbol || this.startSymbol));
        };
        return Grammar;
    })();
    miniup.Grammar = Grammar;    
    var Parser = (function () {
        function Parser(grammar, input) {
            this.grammar = grammar;
            this.input = input;
            this.currentPos = 0;
            this.memoizedParseFunctions = {
            };
            this.debug = true;
            this.previousIsCharacterClass = false;
            this.parsingWhitespace = false;
            this.stack = [];
            this.expected = [];
        }
        Parser.nextMemoizationId = 1;
        Parser.prototype.getRemainingInput = function () {
            return this.input.substring(this.currentPos);
        };
        Parser.prototype.parseInput = function (func) {
            var res = this.parse(func);
            if(res === undefined) {
                if(this.expected.length >= this.input.length) {
                    throw new ParseException(this, "Unexpected end of input. ");
                }
                throw new ParseException(this, "Failed to parse");
            } else {
                if(this.currentPos < this.expected.length) {
                    throw new ParseException(this, "Found superflous input after parsing");
                } else if(this.currentPos < this.input.length) {
                    throw new ParseException(this, "Failed to parse");
                }
                return res;
            }
        };
        Parser.prototype.parse = function (func) {
            var startpos = this.currentPos, isMatch = false, result = undefined;
            try  {
                if(!this.parsingWhitespace && (!func.isCharacterClass || this.previousIsCharacterClass)) {
                    this.consumeWhitespace();
                }
                this.stack.push({
                    func: func,
                    startPos: this.currentPos
                });
                if(this.isMemoized(func)) {
                    if(this.debug) {
                        Util.debug(Util.leftPad(" /" + func.toString() + " ? (memo)", this.stack.length, " |"));
                    }
                    result = this.consumeMemoized(func);
                } else {
                    if(this.debug) {
                        Util.debug(Util.leftPad(" /" + func.toString() + " ?", this.stack.length, " |"));
                    }
                    if(func.isTerminal && !this.parsingWhitespace) {
                        if(!this.expected[this.currentPos]) {
                            this.expected[this.currentPos] = [];
                        }
                        this.expected[this.currentPos].push(func.friendlyName || func.ruleName || func.toString());
                    }
                    result = func.parse(this);
                    if(result !== null && result !== undefined) {
                        Util.extend(result, {
                            parsePos: startpos,
                            ruleName: func.ruleName
                        });
                    }
                    this.memoizedParseFunctions[func.memoizationId][startpos] = {
                        result: result,
                        endPos: this.currentPos
                    };
                }
                return result;
            }finally {
                isMatch = result !== undefined;
                if(isMatch) {
                    if(!this.parsingWhitespace && !func.isCharacterClass) {
                        this.consumeWhitespace();
                    }
                    this.previousIsCharacterClass = func.isCharacterClass;
                } else {
                    this.currentPos = startpos;
                }
                if(this.debug) {
                    Util.debug(Util.leftPad(" \\" + func.toString() + (isMatch ? " V" : " X"), this.stack.length, " |"));
                }
                this.stack.pop();
            }
        };
        Parser.prototype.isMemoized = function (func) {
            if(!func.memoizationId) {
                func.memoizationId = Parser.nextMemoizationId++;
            }
            if(!this.memoizedParseFunctions[func.memoizationId]) {
                this.memoizedParseFunctions[func.memoizationId] = {
                };
                return false;
            }
            return this.memoizedParseFunctions[func.memoizationId][this.currentPos] !== undefined;
        };
        Parser.prototype.consumeMemoized = function (func) {
            var m = this.memoizedParseFunctions[func.memoizationId][this.currentPos];
            this.currentPos = m.endPos;
            return m.result;
        };
        Parser.prototype.consumeWhitespace = function () {
            if(this.grammar.whitespaceMatcher) {
                this.parsingWhitespace = true;
                this.parse(this.grammar.whitespaceMatcher);
                this.parsingWhitespace = false;
            }
        };
        return Parser;
    })();
    miniup.Parser = Parser;    
    var ParseException = (function () {
        function ParseException(parser, message, highlightBestMatch) {
            if (typeof highlightBestMatch === "undefined") { highlightBestMatch = true; }
            this.name = "Miniup.ParseException";
            var pos = highlightBestMatch ? parser.expected.length - 1 : parser.currentPos;
            this.coords = Util.getCoords(parser.input, pos);
            this.message = Util.format("{0} at {1} line {2}:{3}\n\n{4}\n{5}\nExpected: {6}", message, parser.inputName, this.coords.line, this.coords.col, this.coords.linetrimmed, this.coords.linehighlight, parser.expected[pos].join(" or "));
        }
        ParseException.prototype.toString = function () {
            return this.name + ": " + this.message;
        };
        return ParseException;
    })();
    miniup.ParseException = ParseException;    
    var GrammarReader = (function () {
        function GrammarReader() { }
        GrammarReader.miniupGrammar = null;
        GrammarReader.getMiniupGrammar = function getMiniupGrammar() {
            if(GrammarReader.miniupGrammar == null) {
                GrammarReader.miniupGrammar = GrammarReader.bootstrap();
            }
            return GrammarReader.miniupGrammar;
        };
        GrammarReader.bootstrap = function bootstrap() {
            var g = new Grammar(), f = MatcherFactory;
            var equals = f.literal("="), colon = f.literal(":"), semicolon = f.literal(";"), slash = f.literal("/"), and = f.literal("&"), not = f.literal("!"), dollar = f.literal("$"), question = f.literal("?"), star = f.literal("*"), plus = f.literal("+"), lparen = f.literal("("), rparen = f.literal(")"), dot = f.literal(".");
            var identifier = f.named('Identifier', f.regex(RegExpUtil.identifier)), singleQuoteString = f.named('SingleQuoteString', f.regex(RegExpUtil.singleQuoteString)), doubleQuoteString = f.named('DoubleQuoteString', f.regex(RegExpUtil.doubleQuoteString)), singlelinecomment = f.named('Comment', f.regex(RegExpUtil.singleLineComment)), multilinecomment = f.named('MultiLineComment', f.regex(RegExpUtil.multiLineComment)), whitespacechar = f.named('WhiteSpace', f.regex(RegExpUtil.whitespace)), regexp = f.named('Regex', f.regex(RegExpUtil.regex)), characterClass = f.named('CharacterClass', f.regex(RegExpUtil.characterClass));
            var seq = f.sequence, label = f.labeled, opt = f.optional, choice = f.choice;
            var str = g.addRule('string', choice(singleQuoteString, doubleQuoteString));
            var literal = g.addRule('literal', seq(str, opt(f.literal("i"))));
            g.addRule('whitespace', choice(whitespacechar, multilinecomment, singlelinecomment));
            var primary = g.addRule('primary', choice(seq(label('name', identifier), f.negativeLookAhead(seq(opt(str), equals)), literal, characterClass, dot, regexp, seq(lparen, label('expression', f.rule('expression')), rparen))));
            var suffixed = g.addRule('suffixed', choice(seq(label('expression', primary), question), seq(label('expression', primary), star), seq(label('expression', primary), plus), primary));
            var prefixed = g.addRule('prefixed', choice(seq(dollar, label('expression', suffixed)), seq(and, label('expression', suffixed)), seq(not, label('expression', suffixed)), suffixed));
            var labeled = g.addRule('labeled', choice(seq(label('label', identifier), colon, label('expression', prefixed)), prefixed));
            var sequence = g.addRule('sequence', label('elements', f.zeroOrMore(labeled)));
            var choicerule = g.addRule('choice', seq(label('head', sequence), label('tail', f.zeroOrMore(seq(slash, sequence)))));
            var expression = g.addRule('expression', choicerule);
            var rule = g.addRule('rule', seq(label('name', identifier), label('displayName', opt(str)), equals, label('expression', expression), opt(semicolon)));
            g.addRule('grammar', label('rules', f.oneOrMore(rule)));
            g.startSymbol = "grammar";
            return g;
        };
        GrammarReader.buildGrammar = function buildGrammar(ast) {
            var g = new Grammar();
            (ast.rules).map(this.astToMatcher, this).forEach(g.addRule, g);
            return g;
        };
        GrammarReader.astToMatcher = function astToMatcher(ast) {
            return null;
        };
        return GrammarReader;
    })();
    miniup.GrammarReader = GrammarReader;    
    var RegExpUtil = (function () {
        function RegExpUtil() { }
        RegExpUtil.identifier = /[a-zA-Z_][a-zA-Z_0-9]*/;
        RegExpUtil.whitespace = /\s+/;
        RegExpUtil.regex = /\/([^\\\/]|(\\.))*\//;
        RegExpUtil.singleQuoteString = /'([^'\\]|(\\[btnfr"'\\]))*'/;
        RegExpUtil.doubleQuoteString = /"([^"\\]|(\\[btnfr"'\\]))*"/;
        RegExpUtil.singleLineComment = /\/\/[^\\n]*(\\n|$)/;
        RegExpUtil.multiLineComment = /\/\*(?:.|[\\n\\r])*?\*\//;
        RegExpUtil.characterClass = /\[([^\\\/]|(\\.))*\]/;
        RegExpUtil.integer = /-?\d+/;
        RegExpUtil.float = /-?\d+(\.\d+)?(e\d+)?/;
        RegExpUtil.boolRegexp = /(true|false)/;
        RegExpUtil.lineend = /(\r\n)|\r|\n/;
        RegExpUtil.quoteRegExp = function quoteRegExp(str) {
            return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
        };
        return RegExpUtil;
    })();
    miniup.RegExpUtil = RegExpUtil;    
    var Util = (function () {
        function Util() { }
        Util.format = function format(str) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            return str.replace(/{(\d+)}/g, function (match, nr) {
                return "" + args[nr];
            });
        };
        Util.extend = function extend(thing, extendWith) {
            for(var key in extendWith) {
                thing[key] = extendWith[key];
            }
            return thing;
        };
        Util.getCoords = function getCoords(input, pos) {
            var lines = input.substring(0, pos).split(RegExpUtil.lineend);
            var curline = input.split(RegExpUtil.lineend)[lines.length - 1];
            lines.pop();
            var col = pos - lines.join().length;
            return {
                line: lines.length,
                col: col,
                linetext: curline,
                linetrimmed: curline.replace(/(^\s+|\s+$)/, "").replace(/\t/, " "),
                linehighlight: Util.leftPad("^", col - (curline.length - curline.replace(/^\s+/, "").length), "-")
            };
        };
        Util.leftPad = function leftPad(str, amount, padString) {
            if (typeof padString === "undefined") { padString = " "; }
            for(var i = 0, r = ""; i < amount; i++ , r += padString) {
                ;
            }
            return r + str;
        };
        Util.debug = function debug(msg) {
            var args = [];
            for (var _i = 0; _i < (arguments.length - 1); _i++) {
                args[_i] = arguments[_i + 1];
            }
            console && console.log(Util.format.apply(null, [
                msg
            ].concat(args)));
        };
        return Util;
    })();
    miniup.Util = Util;    
})(miniup || (miniup = {}));
