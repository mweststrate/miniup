# Miniup reference guide

## Why miniup?

See the [about.html](about page)

## Examples

## Definitions

This is bread and butter stuff for people experienced in language processing. If you are not a newbie, you can safely skip these definitions. 

* Parser  
Tool that given a grammar and some input, deduces the structure of some input. For example, in a natural language, it might deduces the structure of a sentence and point out the subject, object, verbs, plurals etc. 

* Input  
Some arbitrary text which needs to be recognized

* Grammar  
A set of grammar rules

* Rule 
A grammar rule make a statement about the structure of input. A rule desribes things such as: "A zipcode consists of four numbers followed by two letters (in Dutch)"

* Token  
A single cohesive part of the input. In natural languages this would be for example a single word, or a telephone number

* Keyword  
A token that only performs a literal match, for example the specific zipcode '0000AA'

* Abstract Syntax Tree  
The tree structure of some input, expressed in nodes, as reconized by the parser

* Terminal  
A node in an abstract syntax tree that only matched a token; it matched something literally

* Non-Terminal
A node that matched some structure of the input, for example 'the subject'. Such node might consist of zero or more subnodes. However, the leafs of a tree are always terminals (and terminals can only be leafes).

* Lambda node  
A match that didn't match anything; an empty match. For example the country part in a telephone might not have been defined. 

## About grammars

Grammars consists of a name, a set of options and a set of rules. Each rule has a type, and a *unique* name. Rules are separated by semicolons; All available rule types are discribed below. 

A Grammar has several configurable options:

### casesensitive
Option that indicates if keywords (literals) should be matched case sensitive or case insensitive. *Default: true*

### startsymbol
Identifier (no default) indicating with which rule the parser should start by default. This default can be overriden see the apidocs or the commandline options. 

### usedefaulttokens
If true, all default available terminals (such as comments, floats, numbers, see <a href="#builtintokens">the built-in tokens table</a>, will be constructed for you, and you do not need to define them yourself. *Default: false*

<a name="#builtintokens"></a>

#### Built in token definitions

<table>
<tr><th>Name</th><th>Description</th><th>Regular Expression**</th></tr>

<tr><td>IDENTIFIER
</td><td>Matches common identifiers or words. These are valid variable or function names in most languages
</td><td><pre>[a-zA-Z_][a-zA-Z_0-9]*</pre>
</td></tr>

<tr><td>WHITESPACE*
</td><td>Whitespace; tabs, returns and spaces. 
</td><td>
<pre>\s+</pre>
</td></tr>

<tr><td>INTEGER
</td><td>Positive or negative natural numbers. 
</td><td><pre>-?\d+</pre>
</td></tr>

<tr><td>FLOAT
</td><td>Positive or negative floating point numbers, with optional mantissa
</td><td>
<pre>-?\d+(\.\d+)?(e\d+)?</pre>
</td></tr>

<tr><td>SINGLEQUOTEDSTRING
</td><td>An arbitrarily long string of tokens, between single quotes ('). Single quotes, double quotes and backslashes need to be escaped using a backslash inside the string. 
</td><td><pre>'(?>[^\\']|(\\[btnfr"'\\]))*'</pre>
</td></tr>

<tr><td>DOUBLEQUOTEDSTRING
</td><td>An arbitrarily long string of tokens, between double quotes ("). Single quotes, double quotes and backslashes need to be escaped using a backslash inside the string. 
</td><td><pre>"(?>[^\\"]|(\\[btnfr"'\\]))*"</pre>
</td></tr>

<tr><td>SINGLELINECOMMENT*
</td><td>Single line comment, everything between a double backslash and a linefeed is considered whitespace by the parser
</td><td><pre>//[^\n]*(\n|$)</pre>
</td></tr>

<tr><td>MULTILINECOMMENT*
</td><td>Mulit line comment, everything between \/\* .. and .. \/\* is considered whitespace
</td><td><pre>/\*(?:.|[\n\r])*?\*/</pre>
</td></tr>

<tr><td>BOOLEAN
</td><td>Parses the literals 'true' or 'false'
</td><td><pre>true|false</pre>
</td></tr>

<tr><td>REGULAREXPRESSION
</td><td>Parses a JavaScript style regular expression (except that flags are not supported). 
</td><td><pre>/(?>[^\\/]|(\\.))*/</pre>
</td></tr>

</table>

\* <small>Interpreted as whitespace</small>

\** <small>These regular expressions are in unescaped form. To use them in a Miniup grammar file, apply javascript style escaping: First prepend each forwardslash or backward slash with a backward slash, second, wrap the whole regular expression in forward slashes. Or, take a look at the [miniup.txt](miniup.txt) file, which contains the miniup grammar described in miniup.</small>


### disableautowhitespace 

_boolean, default: false_. If you want to create a white-space sensitive Grammar, set this option to true. In that case you need to match whitespace between tokens manually. Otherwise, the parser assumes that between any two tokens in the Grammar arbitrary whitespace can occur. 

## Grammar rules

Are described [grammar.html](here)

## Command line api

## Java api

## Hello world example

A trivial language will look like this:

	language HelloWorld [
		startsymbol: greeting
	]
	
	sequence greeting : 'hello' 'world'; 
