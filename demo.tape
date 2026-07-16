# Reproduce the README demo GIF: `vhs demo.tape` (requires devkit installed globally)
Output demo.gif

Set FontSize 16
Set Width 900
Set Height 480
Set TypingSpeed 35ms
Set Padding 20

Type "devkit calc '(2 + 3) * 4 ^ 0.5'"
Enter
Sleep 1s

Type "devkit calc '2^-2' --json"
Enter
Sleep 1s

Type "echo 'hello hello world' | devkit stats - --json"
Enter
Sleep 1.5s

Type "devkit convert 100 c f"
Enter
Sleep 1s

Type "devkit calc '1/0'; echo exit=$?"
Enter
Sleep 2.5s
