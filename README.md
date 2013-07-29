miniup
======

[short intro]

Welcome to mini-up, the Lightweight ease-to-use parsing library

- Common constructions 
- Natural AST
- Portable 

- Extensable
- Conventions over configuration
- Scannerless

[how to parse a file - command line]

java -jar Peach.jar -l grammar.txt -i input.txt -o;

See the --help option for more information

[how to parse a file - java]

String grammarName = Miniup.loadLanguageDefinitionFromFile("grammar.txt");
Node myAst         = Miniup.parse(grammarName, "someinput");

[how to create a grammar]
1. construct file

2. write rules

3. all rule types