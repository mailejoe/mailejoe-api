## Development Setup

### Pre-requisites

Node.js 14.x+ is required
NPM 6.x+ is required
Docker

Copy .env.example and rename to .env. By default running the dependencies script above will setup your local environment with the parameters specified in the file.

### Setting up Postgres

It is recommended to use a Dockerized version of Postgres to make development easier.

NOTE: You will need to use full path names for Docker, below are example
paths but you will need your own exact path names based on your OS and setup.

First create the initial directory, testdata/, that will be the persistent
storage of the Postgres container.

Windows (with Powershell)

```
$pwd = (Get-Location).Path
new-item -path $pwd -name testdata -itemtype directory
docker run --rm --name postgres -v $pwd/testdata:/testdata -v $pwd/testdata/postgres:/var/lib/postgresql/data -v $pwd/seeds:/tmp/seeds -e TZ=America/Chicago -e PGTZ=America/Chicago -e POSTGRES_USER=mjadmin -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mailejoe -d -p 5432:5432 postgres
```

Mac/Linux

```
mkdir ./testdata
docker run --rm --name postgres -v $(pwd)/testdata:/testdata -v $(pwd)/testdata/postgres:/var/lib/postgresql/data -v $(pwd)/seeds:/tmp/seeds -e TZ=America/Chicago -e PGTZ=America/Chicago -e POSTGRES_USER=mjadmin -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mailejoe -d -p 5432:5432 postgres
```

Now we need to initialize the database in the docker container.

```
docker ps
```

Find the ID of the docker container you just started.

```
sudo docker exec -it <id> /bin/bash
```

You will need to enter your system password if prompted.

Finally run the following command.

```
psql -U mjadmin -d mailejoe -f /tmp/seeds/seeds.sql
```

That's all. The container will always spin up even on system restart.

### Exploring the Postgres database via CLI

If you just want to login to Postgres to explore the data or run additional commands then run the following command.

```
psql -U mjadmin -d mailejoe
```

### Setting up PgAdmin via Docker

Mac/Linux/Windows

```
docker run --rm --name pgadmin -e PGADMIN_DEFAULT_EMAIL=admin@admin.com -e PGADMIN_DEFAULT_PASSWORD=root -e POSTGRES_DB=mailejoe -d -p 5050:80 dpage/pgadmin4
```

Then open your browser and go the url: http://localhost:5050

Enter the email and password as follows:
admin@admin.com
root

When adding the local Postgres docker container to connect to, be sure to get the IPAddress
of the container itself via the command:

```
docker inspect <docker_id> | grep IPAddress
```

where `docker_id` is the ID of the postgres container that is running.

### Install Dependencies

```bash
npm install
```

### Running the app locally

```bash
npm start
```

## Usage

Send an HTTP request directly to the endpoint using a tool like curl

```bash
curl http://localhost:3000/ping
```
