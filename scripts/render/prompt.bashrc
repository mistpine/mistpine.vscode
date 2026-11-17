# The prompt in the terminal scenes (as in mistpine.ghostty): path in blue,
# branch in magenta and a green arrow, all ANSI colors so they come from the
# theme's terminal palette.
PS1='\[\e[34m\]~/fog\[\e[0m\] \[\e[35m\]main\[\e[0m\] \[\e[32m\]❯\[\e[0m\] '
HISTFILE=/dev/null
unset PROMPT_COMMAND
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 LS_COLORS='di=34:ln=36:ex=32'
