docker stop postgres
$pwd = (Get-Location).Path
Remove-Item -Recurse -Force $pwd\testdata
New-Item -ItemType Directory -Force -Name testdata -Path $pwd
docker run --rm --name postgres -v $pwd/testdata:/testdata -v $pwd/testdata/postgres:/var/lib/postgresql/data -v $pwd/seeds:/tmp/seeds -e TZ=America/Chicago -e PGTZ=America/Chicago -e POSTGRES_USER=mjadmin -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mailejoe -d -p 5432:5432 postgres
