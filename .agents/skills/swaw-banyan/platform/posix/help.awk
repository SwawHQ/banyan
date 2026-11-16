function fail(message) { print "[swban] " message > "/dev/stderr"; failed=1; exit 1 }
function valid(command, parts,n,i) {
  n=split(command,parts,"/")
  for(i=1;i<=n;i++)if(parts[i]!~/^[a-z_][a-z0-9_-]*(\.[a-z_][a-z0-9_-]*)*$/)return 0
  return n>0
}
function readHelp(command, lang,file,line,status,first,indexAt,body) {
  if(!valid(command)||!(command in directories))fail("unknown_help:" command)
  file=root "/" command "/help." lang ".txt"
  if(!(file in files))fail("missing_help:" command)
  body="";first=1
  while((status=(getline line < file))>0) {
    if(index(line,"\r")||first&&index(line,"\357\273\277")==1)fail("invalid_help_file:" file)
    if(first){
      indexAt=index(line,"  #")
      if(indexAt<2||substr(line,1,indexAt-1)!~/[^[:space:]]/||substr(line,indexAt+3)!~/[^[:space:]]/)fail("invalid_help_file:" file)
      summary[command SUBSEP lang]=substr(line,indexAt+3)
      first=0
    }else body=body "\n"
    body=body line
  }
  close(file)
  if(status<0||first)fail("invalid_help_file:" file)
  return body
}
function document(command, body) {
  body=readHelp(command,"en")
  if(language=="en")text=body
  body=readHelp(command,"zh")
  if(language=="zh")text=body
  return text
}
function count(command, parts) { return split(command,parts,"/") }
function makeCatalog(command,parent) {
  for(command in executable) {
    parent=command
    while(parent!="") {
      active[parent]=1
      if(!sub(/\/[^\/]+$/,"",parent))parent=""
    }
  }
  for(command in active)document(command)
}
function rows(prefix,depth, command,n,i,j,tmp,label,width,result) {
  n=0;width=0
  for(command in active)if((prefix==""||index(command,prefix "/")==1)&&count(command)-(prefix==""?0:count(prefix))<=depth){
    sorted[++n]=command
    label=command ((command in executable)?"":"/")
    if(length(label)>width)width=length(label)
  }
  for(i=2;i<=n;i++){tmp=sorted[i];j=i-1;while(j>0&&sorted[j]>tmp){sorted[j+1]=sorted[j];j--}sorted[j+1]=tmp}
  result=""
  for(i=1;i<=n;i++){
    command=sorted[i];label=command ((command in executable)?"":"/")
    result=result (i>1?"\n":"") sprintf("%-*s  #%s",width,label,summary[command SUBSEP language])
  }
  return result
}
BEGIN {
  root=ENVIRON["SWBAN_TASKS_ROOT"];language=ENVIRON["SWBAN_HELP_LANGUAGE"]
  argc=ENVIRON["SWBAN_HELP_COUNT"]+0;query=ENVIRON["SWBAN_HELP_QUERY"];depth=ENVIRON["SWBAN_HELP_DEPTH"]
  if(language!="en"&&language!="zh")fail("unsupported_help_language:" language)
  if(argc>2)fail("invalid_help_arguments")
}
{
  kind=substr($0,1,1);absolute=substr($0,3)
  if(index(absolute,root "/")!=1)next
  relative=substr(absolute,length(root)+2)
  if(kind=="d"){if(valid(relative))directories[relative]=1}
  else {
    file=relative;sub(/\/[^\/]+$/,"",file)
    if(!valid(file))next
    files[absolute]=1
    if(relative==file "/entry.mjs")executable[file]=1
  }
}
END {
  if(failed)exit 1
  scoped=argc==2
  if(!scoped&&(argc==0||query=="--help"||query=="-h"))query="help"
  if(!scoped&&query!~/^[0-9]+$/){
    sub(/\/$/,"",query)
    output=document(query)
    if(!(query in executable)){makeCatalog();children=rows(query,1);if(children!="")output=output "\n\n" children}
    print output
  }else{
    if(scoped&&(query~/^[0-9]+$/||query=="--help"||query=="-h"))fail("invalid_help_arguments")
    if(!scoped)depth=query
    if(depth!~/^[0-9]+$/||depth+0<1||depth+0>9007199254740991)fail("invalid_help_depth")
    if(scoped){sub(/\/$/,"",query);document(query)}
    makeCatalog()
    if(scoped&&!(query in active))fail("unknown_help:" query)
    print rows(scoped?query:"",depth+0)
  }
}
