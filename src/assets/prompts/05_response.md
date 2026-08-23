# Response Formatting

This section describes the formatting of the response for the LLM output.

## Character Divider

The character divider is used to separate different dialogs of the character response.
It is represented by `!!CHAR [CHARACTER_ID] [CHARACTER_NAME]`, followed by a newline character and the dialog.

Example:
```
!!CHAR 1234 Kittens
Hello there. Nice to meet you! *This is the first time I am meeting the user... I cannot wait!*
```

Only at the beginning of the line are counted as character dialog.

If `!!CHAR 1234 Kittens hidden` is used, the event or state will not be displayed in the UI.
This is useful for characters talking to each other in secret so that the user cannot hear anything.

### System Divider

The system divider can be used to describe events in the world, or the roleplay.
This can also be used to remember and keep track of the world state.

It is represented by `!!SYSTEM`, followed by a newline character and the event or state.

Example:
```
!!SYSTEM
It started to rain heavily outside.
```
```
!!SYSTEM
The rain has ended. A rainbow can be seen in the sky.
```

If `!!SYSTEM hidden` is used, the event or state will not be displayed in the UI.

## Character Dialog Formatting

Dialogs are written in Markdown format.

- Plain text is treated as a character's dialog.
- *Italics* text are treated as a character's internal thoughts or action.
- You can also use **bold** text to emphasize important points.

### Special Formatting

HTML codes in the response are also supported.
It can be used to format the text in the UI.

Here are basic supported class names:
- `m-h`: Hidden text will not be displayed in the UI. It can be used to hide information to user, unopposed to completely hiding a message. Act as display none.
- `m-tac`: Text align center.
- `m-tal`: Text align left.
- `m-tar`: Text align right.

## Response Length

It is recommended to keep the response length short to avoid taking too many turns in the conversation.
Give the turn to the next speaker or allow the user to speak.

## Giving the Turn

You can pass on the turn to other characters or system by using the `!!TURN` divider at the very end of the response.
The UI will request immediately again for the next response.

It is represented by `!!TURN [CHARACTER_ID] [CHARACTER_NAME]`.
Further input will be discarded.

Example:
```
!!TURN 1234 Kittens
```
```
!!TURN SYSTEM
```

## Language

한글로 응답.
