# Miniup parsing library

Welcome to Miniup, the lightweight parsing library! Until Miniup, designing language grammars and writing or using parsers was only for those with a thourough background in grammatics! But with Miniup, designing a new expression, scripting or prototyping a full blown language should be possible for everyone with moderate programming experience!

First of all, what distinguishes Miniup from all the others?

## Writing syntax rules have never been so easy. 
Were other parser generators are bound tightly to their parsing algoritm, Miniup lets you describe what you want to achieve! For example, a list of comma separated `Thing`s in a typical LL-k based parser generator looks like:

`ListOfThings = Thing (',' ListOfThings)?`

Miniup allows you to just state that you just want a list of things. (Yes, the line above describes a list, although it does not look like one). This is what it looks like in miniup:

`list ListOfThings = Thing ',';`

(Or, inlined: `(Thing ',')*`

As everyone with some experience in writing grammars knows, things become even more difficult in more complex patterns like mathematical experessions! But fear not, those are built-in in Miniup as well. See the [reference guide](refguide.html) for more details.  

## Ready to use parse tree
Somehow, if parsing succeeds, you need to use the parsed structures in your code. Miniup normalizes the parse tree into a nice recusive and ready-to-use structure. Miniup can create such a tree because it knows what you intended to achieve in the grammar rules. Because it knows you wanted to create a list, it will construct an array like structure for you in the parse tree!

## Portable and easy to use library
Miniup has been designed for portability; it has no external dependencies and can by used directly as library in your project or as standalone application to test your grammar. Furthermore Miniup has a small but extensible code base and uses no complex, java specific constructions, so it will be easy to translate it to any programming language. 

Using Peach in your java application is as simple as:

`
Peach.loadLanguageDefinitionFromFile("mysyntax.txt");
ASTNode myAst = Peach.parse("mysyntax", "someinput");
`

or from the command line:

`java -jar Peach.jar -l mysyntaxt.txt -t "someinput";`

Thats all! (Or read the full [command line API](cli.html))

## Thats all?
Yup, thats all. Just download [Miniup](miniup-1.0.jar) start playing with the [examples](examples.html) to try it for your self. Or, if you are interested in the background of Miniup, keep on reading...

## Some backgrounds
For the more theoretic readers; to characterize Miniup: Miniup is as Scannerless bottom-up parser, and as such inspired by the [Stratego/XT toolkit](http://www.syntax-definition.org/Sdf/SdfSoftware). Scannerless indicates that Miniup does not do a lexical analysis before parsing and as a result, it can read multiple syntaxes within the same input file. It is a context-aware parser. It uses a bottom-up parsing approach, but the backtrack and look ahead behavior depends on the type of rule it tries to match. 
 
Peach has no disambugation strategy. It allows ambiguos grammars. Peach just goes with the first match it can find and does not look further. This might be a shocking strategy to some, but is very practical many cases, such as the dangling else problem. 

## Further reading
[Examples](examples.html)
[Reference Guide](refguide.html)

* 

So, why yet another parsing library? I invented peach when I was searching for a parser for a template engine I was working on. My first thoughts went to ANTLR, with which I already had a bit of experience. I soon however discovered a few problems, first of all, my language was a mixin of the template language and HTML. With ANTLR i felt obligated to parse the HTML as well, since the lexical analysis of the file and the actual parsing are separated, for this reason it can't distinguish tokens which look (or even are) similar. 

Furthermore the need of syntactic predicates felt unnatural. (And I just don't like generated code in my build process). I searched a bit further but it appeared to me that quite some parsers have a lot of dependencies. But the most renewing thought (at least to me), was that the language definitions are based on (E)BNF rules and that they are quite unnatural. Both top-down and bottom-up parsers have their own typical language patterns. For example a typical list construction a bottom-up parser could look like:

ListOfThings = Thing (',' ListOfThings)?

And then I don't mention how to define left- or right associative operators with the right priorities. As a language designer; usually you know exactly what syntax you want, but you have to waste quite some brainpower to figure out how to express this properly and efficiently in your current parsing algorithm. 

And the insanity does not stop after defining the syntax. After parsing you have to normalize your Abstract Syntaxt Tree back to what you originally intended; the ListOfThings listed above for example might result in a recursive structure, not a list structure. So I decided to write a parser that would do things different, a parser that would have its own principles.

----
Easy-to-write syntax rules
_Declartive rule description for common language patterns

The Peach parser does not use BNF rules to parse your input, rather, it is based on the few basic constructions allmost all programming languages are based on. In Peach, we distinguish the following types of rules: Sequences, lists, choices, (binary)operators and sets. Using such constructions, defining a list of things is as simple as:

list ListOfThings = Thing ',';

and your operators can be defined as:

choice   Expr =  addExpr | mulExpr | INTEGER;
operator mulExpr = '*' Expr;
operator addExpr = '+' Expr;

---
Well formed AST
_Stop preprocessing, start coding_

Since the syntax rules of your language are writandten declaratively, Peach knows what you want and takes advantage, it provides you a well formed normalized Abstract Syntax Tree once the parsing process succeeds. The tree is easy to reflect and is ready for interpretation! The full API of the AST nodes produced by Peach is available [here]. Example ASTs produced by the previous examples are:

(list example)
(operator example)


---


---
Parsing startegy
_For the linguists among us_


For the more theoretic readers; to characterize Peach: Peach is as Scannerless bottom-up parser, and as such inspired by the stratego/xt toolkit (http://www.syntax-definition.org/Sdf/SdfSoftware). Scannerless indicates that Peach does not do a lexical analysis before parsing and as a result, it can read multiple syntaxes within the same input file. It is a context-aware parser. It uses a bottom-up parsing approach, but the backtrack and look ahead behavior depends on the type of rule it tries to match. 
 
Peach has no disambugation strategy. It allows ambiguos grammars. Peach just goes with the first match it can find and does not look further. This might be a shocking strategy to some, but is very practical many cases, such as the dangling else problem. 


---
...And more
_More interesting things about Peach_

To get your language up and running as fast as possible, Peach provides several flags to easily fine-tune the behavior of your language. For example you can enable the useBuiltinTokens flag to have default token recognition for whitespace, identifiers, comments, strings, regular expressions and numbers. Some rule constructions come with their on flags as well, such as 'disallowEmpty' to disallow empty lists, or 'rightAssociative' to define that an operator is right associative. 

Peach is runtime extensible, and you can extend your language on the fly, or you could even introduce new language constructs to Peach. Take for example a look at [this] tutorial. 
