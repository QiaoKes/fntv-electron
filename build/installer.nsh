!macro customInstall
  StrCpy $0 $EXEFILE

  StrCpy $1 "" ; 协议
  StrCpy $2 "" ; 域名
  StrCpy $5 "" ; 端口（可选）

  StrLen $R0 $0
  StrCpy $R1 0

  ; 查找协议
  loop_start:
    IntCmp $R1 $R0 loop_end 0 loop_end
    StrCpy $R2 $0 7 $R1
    StrCmp $R2 "_https_" found_https loop_check_http
    Goto loop_check_http
  loop_check_http:
    StrCpy $R2 $0 6 $R1
    StrCmp $R2 "_http_" found_http loop_next
    Goto loop_next
  loop_next:
    IntOp $R1 $R1 + 1
    Goto loop_start
  loop_end:
    MessageBox MB_ICONSTOP "安装包文件名格式不正确！应为 产品名_版本号_协议_域名_端口.exe，请检查安装包名称。" /SD IDOK

    ; 调用卸载程序
    IfFileExists "$INSTDIR\Uninstall 飞牛影视.exe" do_uninstall end_uninstall
    Goto end_uninstall

    do_uninstall:
      ; 用双引号包裹路径，支持空格
      ExecWait '"$INSTDIR\Uninstall 飞牛影视.exe" /S' ; /S 表示静默卸载
    end_uninstall:
      Abort

  found_https:
    StrCpy $1 "https"
    IntOp $R1 $R1 + 7
    Goto got_proto
  found_http:
    StrCpy $1 "http"
    IntOp $R1 $R1 + 6

  got_proto:
    StrCpy $2 $0 "" $R1
    ; 去掉 .exe
    StrLen $R2 $2
    IntOp $R2 $R2 - 4
    StrCpy $2 $2 $R2

    ; 查找最后一个 _ 分隔域名和端口
    StrCpy $R3 $2
    StrLen $R4 $R3
    StrCpy $5 "" ; 默认端口为空

    find_last_underscore:
      IntOp $R4 $R4 - 1
      IntCmp $R4 -1 done_split 0 check_char
      Goto check_char
    check_char:
      StrCpy $R6 $R3 1 $R4
      StrCmp $R6 "_" split_found find_last_underscore
      Goto find_last_underscore

    split_found:
    ; 提取端口
    IntOp $R4 $R4 + 1
    StrLen $R7 $R3
    IntOp $R7 $R7 - $R4
    StrCpy $5 $R3 $R7 $R4

    ; 提取域名，去掉最后的 "_"
    IntOp $R4 $R4 - 1
    StrCpy $2 $R3 $R4
    Goto done_split

    done_split:

    ; 拼接完整 URL
    StrCmp $5 "" no_port add_port
    no_port:
      StrCpy $3 "$1://$2"
      Goto write_json
    add_port:
      StrCpy $3 "$1://$2:$5"

    write_json:
      FileOpen $4 "$INSTDIR\\config.json" w
      FileWrite $4 "{"
      FileWrite $4 "$\"server$\": $\"$3$\""
      FileWrite $4 "}"
      FileClose $4
!macroend
