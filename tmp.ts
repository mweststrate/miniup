module miniup {


		export class CLI {
			//TODO: use optimist

		private static Queue <string > mainArguments = new LinkedList < >:string ();

		/**
		 * Processes command line arguments. Use the help command to find out which commands are available
		 * @param args
		 * @{
		 */
		public static main(string[]args) {}{
			for (number i = 0; i < args.length; i++)
				mainArguments.add(args[i]);

		 showOutput : bool = false;
		 input:string = null;
		 language:string = null;
		 startSymbol:string = null;
			long start = System.currentTimeMillis();

			while (!mainArguments.isEmpty()) {
			 cmd:string = mainArguments.poll();
				if ("-T".equals(cmd)) {
					Miniup.bootstrap();
					TestSuite.runTestsuite();
				}
				else if ("-v".equals(cmd))
					Miniup.VERBOSE = true;
				else if (("-h").equals(cmd))
					printHelp();
				else if ("-o".equals(cmd))
					showOutput = true;
				else if ("-i".equals(cmd))
					input = Util.readFileAsString(mainArguments.poll());
				else if ("-t".equals(cmd))
					input = mainArguments.poll();
				else if ("-g".equals(cmd))
					language = mainArguments.poll();
				else if ("-S".equals(cmd))
					Miniup.SHOWSTATS = true;
				else if ("-c".equals(cmd))
					Miniup.USE_TOKEN_MEMOIZATION = true;
				else if ("-s".equals(cmd))
					startSymbol = mainArguments.poll();
				else if ("-l".equals(cmd)) {
				 lib:string = mainArguments.poll();
					Miniup.loadLanguageFromFile(lib);
					p("  Loaded grammar as library: " + lib);
				}
				else
					throw new IllegalArgumentException("Unknown option: '" + cmd + "'");
			}

			if (input != null) {
				System.out.println("Preparing parse");

				if (language == null) {
					Miniup.bootstrap();
					language = "Miniup";
				}
				else
					language = Miniup.loadLanguageFromFile(language);

				System.out.println("Loaded language '" + language + "'");

				Node node = Miniup.parse(language, input, startSymbol);

				System.out.println("Parse succeeded :)");

				if (showOutput)
					System.out.println(node.toMultilineString());

			}
			if (Miniup.SHOWSTATS)
				System.out.println("Total time: " + (System.currentTimeMillis() - start) + " ms.");

			System.exit(0);
		}

			private static p(string s) {
				System.out.println(s);
			}

			private static p(string flag, arg:string, help:string) {
				System.out.print("\t-");
				System.out.print(flag);
				System.out.print("\t");
				if (arg != null)
					System.out.print("[" + arg + "]");
				else
					System.out.print("\t");
				System.out.print("\t");
				p(help);
			}

			private static printHelp() {
				p("Miniup parsing library CLI version 1.0");
				p("Written by Michel Weststrate, 2012, michel@mweststrate.nl");
				p("Vist the project at http://[githuburl]"); //TODO:
				p("");
				p("Command line arguments:");
				p("g", "filename", "Parse using the grammar definition defined in [filename]");
				p("i", "filename", "Use the given file as input for the parser");
				p("");
				p("c", null, "Use token memoization, might increase the parse speed at the cost of memory consumption");
				p("h", null, "Prints this help message");
				p("l", "filename", "Loads an additional grammar definition, to be able to resolve 'import' rules");
				p("o", null, "Prints the AST created by the parser to stdout");
				p("s", "rulename", "Use the given rulename as start symbol while parsing");
				p("S", null, "Print statistics after the parsing has finished");
				p("t", "sometext", "Use the provided text as input for the parser");
				p("T", null, "Run the internal test suite");
				p("v", null, "Verbose mode. Prints all match attemps of the parser to stdout");
			}
		}

		/**
		 * A pair of things, useful in a language that doesn't contain tuples...
		 *
		 * Probably grabbed it from somewhere of the internetz..
		 *
		 * @author michel
		 *
		 * @param <A>
		 * @param <B>
		 */
		export class Pair <A, B > {
		private final A first;
		private final B second;

		public Pair(A first, B second) {
			this.first = first;
			this.second = second;
		}

			public static <C, D > Pair < C, D > pair(C first, D second) {
				return new Pair < C, D > (first, second);
			}

			public number hashCode() {
				number hashFirst = first != null ? first.hashCode() : 0;
				number hashSecond = second != null ? second.hashCode() : 0;

				return (hashFirst + hashSecond) * hashSecond + hashFirst;
			}

			@SuppressWarnings("unchecked")
			public equals : bool(Object other) {
				if (other instanceof Pair) {
					Pair < A, B > otherPair = (Pair < A, B >) other;
					return
					((this.first == otherPair.first ||
							(this.first != null && otherPair.first != null &&
							  this.first.equals(otherPair.first))) &&
					 (this.second == otherPair.second ||
							(this.second != null && otherPair.second != null &&
							  this.second.equals(otherPair.second))));
				}

				return false;
			}

			public toString:string()
			{
				return "(" + first + ", " + second + ")";
			}

			public A getFirst() {
				return first;
			}

			public B getSecond() {
				return second;
			}

			public Pair < A, B > clone() {
				return Pair.pair(first, second);
			}


		/**
		 * Some utility functions used by the parsers. You might find similar methods, probably faster, in apache commons.
		 * Those are here just to make the parser dependency free.
		 * @author michel
		 *
		 */
		export class Util {

		/**
		 * Given a filename, returns it contents as 		 *:string @param filePath
		 * @return
		 * @{
		 */
		public static readFileAsString:string(string filePath) {}{
			byte[]buffer = new byte[(number) new File(filePath).length()];
			BufferedInputStream f = new BufferedInputStream(new FileInputStream(filePath));
			f.read(buffer);
			return new string(buffer);
		}

			/**
			 * If idx is positive, returns the substring starting at the index, otherwise, return the substring ending at that index
			 * @param base
			 * @param idx
			 * @return
			 */
			public static substring:string(string base, number idx) {
				if (idx >= 0)
					return substring(base, idx, 0);
				return substring(base, 0, idx);
			}

			/**
			 * Substring implementation that never {
			 *
			 * if input: "miniup"
			 *
			 * 0 (,0)  -> "miniup"
			 * 2 (,0)  -> "niup"
			 * 4, 2    -> "up"
			 * (0,) -2 -> "mini"
			 * 1, -2   -> "ini"
			 * -1, -2  -> "i"
			 * -1, 6   -> "p"
			 * @param base basestring to get a substring from
			 * @param fromleft if positive, start index; if negative, length:string
			 * @param fromright if negative, amount of characters from the end, if positive, length:string
			 * @return
			 */
			public static substring:string(string base, number fromidx, number toidx) {
				number from = fromidx;
				number len = base.length();
				number to = toidx;

				if (from == 0 && to == 0)
					to = len;
				else if (from >= 0 && to <= 0)
					to = len + to;
				else if (from >= 0 && to > 0)
					to = from + to;
				else if (from < 0 && to < 0) {
					to = len + to;
					from = to + from;
				}
				else if (from < 0 && to >= 0)
					from = to + from;
				else
					throw new RuntimeException("Unimplemented substring case: " + fromidx + ", " + toidx);

				from = Math.max(from, 0);
				to = Math.max(from, Math.min(to, len));

				return base.substring(from, to);
			}

			public static leftPad:string(string string, number col) {
				number v = col;
			 r:string = "";
				while (v-- > 0)
					r += " ";
				return r + string;
			}

			public static join:string(Collection < >:string stuff, separator:string) {
				StringBuilder b = new StringBuilder();
				number i = 0;
				for (string item: stuff) {
					b.append(item);
					if (i < stuff.size() - 1)
						b.append(separator);
					i++;
				}
				return b.toString();
			}

			public static number countMatches(string input, needle:string) {
				number r = 0;
				number p = 0;
				number i = 0;
				while ((i = input.indexOf(needle, p)) != -1) {
					p = i + 1;
					r++;
				}
				return r;
			}

			public static unescape:string(string text) {
				//naive unescape function..
				return text.replaceAll("\\\b", "\b")
					.replaceAll("\\\t", "\t")
					.replaceAll("\\\n", "\n")
					.replaceAll("\\\f", "\f")
					.replaceAll("\\\r", "\r")
					.replaceAll("\\\\", "\\")
					.replaceAll("\\'", "'")
					.replaceAll("\\\"", "\"");
			}


			public static trimToLength:string(string string, number maxlength) {
				if (string == null || string.length() < maxlength)
					return string;
				return string.substring(0, maxlength);
			}

			public static getInputLineByPos:string(string input, number position) {
				number prev = input.lastIndexOf('\n', position);
				number next = input.indexOf('\n', position);
			 line:string = Util.substring(input, prev + 1, Math.min(position + 20, next - prev));
				return line.replaceAll("\t", " ");
			}

			public static getInputLine:string(string input, number nr) {
				number cur = -1;
				for (number i = nr; i > 1; i--) {
					cur = input.indexOf('\n', cur + 1);
					if (cur == -1)
						return null;
				}

				number next = input.indexOf('\n', cur + 1);
			 line:string;
				if (next == -1)
					line = input.substring(cur + 1);
				else
					line = input.substring(cur + 1, next);

				return line.replaceAll("\t", " "); //to fix highlighting for tabs. Better would be to insert a tabs before the cursor if needed
			}

			public static hightlightLine:string(string inputString, number linenr,
					number colnr) {
					 msg:string = "at line " + linenr + " column " + colnr + ":\n\n";
						msg += getInputLine(inputString, linenr) + "\n";
						msg += Util.leftPad("^", colnr - 1);
						return msg;
					}
		}
}