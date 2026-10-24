#!/bin/sh
# Testes que cobrem a migração de um Move para ficha: node migrar-teste.sh <id>
id="$1"
for t in "moves-$id" moves-revisao moves-fichas moves-contracts moves-params moves-ui moves-harden moves-order ai-new-moves ai-profile calibration-base move-matrix; do
  [ -f "test/$t.test.mjs" ] || continue
  out=$(timeout 170 node "test/$t.test.mjs" 2>&1); code=$?
  echo "$t: $(echo "$out" | tail -1) (saida $code)"
  [ $code -ne 0 ] && echo "$out" | grep -A4 "✗" | head -12
done
exit 0
