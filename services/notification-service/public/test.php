<?php
$s = getenv('JWT_SECRET');
$t = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMzMzMzMzMy0zMzMzLTMzMzMtMzMzMy0zMzMzMzMzMzMzMzMiLCJyb2xlIjoidXNlciIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsImlhdCI6MTc3ODM0MDU2NSwiZXhwIjoxNzc4MzQxNDY1fQ.p06aPyq6XiRxAEIdGT7w6K0QFlU0vRfyFO09MCg14Es';
list($h,$p,$sig) = explode('.', $t);
$v = str_replace(['+','/','='],['-','_',''], base64_encode(hash_hmac('sha256', "$h.$p", $s, true)));
echo "Secret: $s\nExpected: $sig\nCalculated: $v\n";
