head -n `grep -n "<a name=" CHANGELOG.md | head -n 5 | tail -n 1 | cut -d: -f1` CHANGELOG.md > TEMP.md
cp TEMP.md CHANGELOG.md
rm TEMP.md