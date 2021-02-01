# Path to your oh-my-zsh installation.
export ZSH="/root/.oh-my-zsh"

source $ZSH/oh-my-zsh.sh

source ~/.oh-my-zsh/antigen.zsh

# Load the oh-my-zsh's library.
antigen use oh-my-zsh

# Bundles from the default repo (robbyrussell's oh-my-zsh).
antigen bundle git
antigen bundle heroku
antigen bundle pip
antigen bundle lein
antigen bundle command-not-found

# Syntax highlighting bundle.
antigen bundle zsh-users/zsh-syntax-highlighting

# Load the theme.
antigen theme sobolevn/sobole-zsh-theme
#antigen theme robbyrussell
# Tell Antigen that you're done.
antigen apply

set -o vi
export uml=/root/lab/uml/linux-5.5.1
export PATH=$PATH:/root/script

