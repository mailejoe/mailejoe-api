# Helpful Commands/Tricks

### Logging into the database from the command line

```
psql -U <username> -d <database> -h <host>
```

If you are running the database via a docker container, then follow
these steps:

Windows/MacOS/Linux

```
docker ps
```

Find the Container ID of the running postgres container and copy it.

MacOS/Linux

```
sudo docker exec -it <container id> /bin/bash
psql -U <username> -d <database>
```

Windows

```
docker exec -it <container id> /bin/bash
psql -U <username> -d <database>
```
