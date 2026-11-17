# The 16 ANSI colors as swatches and as text, then the text styles (as in
# mistpine.ghostty's palette scene).
names=(black red green yellow blue magenta cyan white)
# Standard SGR codes (40–47 and 100–107 for backgrounds), so every swatch
# is one of the theme's 16 colors.
swatches() {
  local bg=$1 fg=$2 base=$3 i
  for line in 1 2; do
    printf '  '
    for i in {0..7}; do printf '\e[%dm%10s\e[0m ' $((bg + i)) ''; done
    printf '\n'
  done
  printf '  '
  for i in {0..7}; do printf '\e[%dm%-10s\e[0m ' $((fg + i)) "$((base + i)) ${names[i]}"; done
  printf '\n\n'
}
printf '\n'
swatches 40 30 0
swatches 100 90 8
printf '  \e[1mbold\e[0m  \e[3mitalic\e[0m  \e[2mfaint\e[0m  \e[4munderline\e[0m  '
printf '\e[9mstrike\e[0m  \e[7minverse\e[0m  '
printf '\e[1;31mbold red\e[0m  \e[1;32mbold green\e[0m\n\n'
