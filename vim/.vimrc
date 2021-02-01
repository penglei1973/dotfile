
set number
set paste
set tabstop=9
set expandtab
set shiftwidth=4
set softtabstop=4
syntax on
syntax enable
filetype on
"set background=dark
filetype indent on
set nocompatible
set mouse=v
set backspace=indent,eol,start
set t_Co=16
nmap <C-S> :update<CR>
if has("autocmd")
  au BufReadPost * if line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g'\"" | endif
endif
"""""""" FOLD
set foldcolumn=1
set foldmethod=indent
set foldnestmax=10
set nofoldenable
set foldlevel=2

"""""""" Vundle
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()
Plugin 'VundleVim/Vundle.vim'
Plugin 'python_ifold'
" Plugin 'LucHermitte/VimFold4C'
Plugin 'preservim/nerdtree'
Plugin 'Valloric/YouCompleteMe' 
Plugin 'rdnetto/YCM-Generator', { 'branch': 'stable'}
call vundle#end()            " required
filetype plugin indent on    " required

" 设置NerdTree

map <F2> :NERDTreeMirror<CR>

""""""" YCM CONFIG
" 跳转快捷键
nnoremap <c-h> :YcmCompleter GoToDeclaration<CR>|
nnoremap <c-j> :YcmCompleter GoToDefinition<CR>| 
nnoremap <c-k> :YcmCompleter GoToReferences<CR>|

"" 停止提示是否载入本地ycm_extra_conf文件
let g:ycm_confirm_extra_conf = 0
"" 语法关键字补全
"let g:ycm_seed_identifiers_with_syntax = 1
"" 开启 YCM 基于标签引擎
"let g:ycm_collect_identifiers_from_tags_files = 1
"" 从第2个键入字符就开始罗列匹配项
"let g:ycm_min_num_of_chars_for_completion=2
"" 在注释输入中也能补全
"let g:ycm_complete_in_comments = 1
"" 在字符串输入中也能补全
"let g:ycm_complete_in_strings = 1
"" 注释和字符串中的文字也会被收入补全
"let g:ycm_collect_identifiers_from_comments_and_strings = 1
"" 弹出列表时选择第1项的快捷键(默认为<TAB>和<Down>)
"let g:ycm_key_list_select_completion = ['<C-n>', '<Down>']
"" 弹出列表时选择前1项的快捷键(默认为<S-TAB>和<UP>)
"let g:ycm_key_list_previous_completion = ['<C-p>', '<Up>']
"" 主动补全, 默认为<C-Space>
""let g:ycm_key_invoke_completion = ['<C-Space>']
"" 停止显示补全列表(防止列表影响视野), 可以按<C-Space>重新弹出
""let g:ycm_key_list_stop_completion = ['<C-y>']


