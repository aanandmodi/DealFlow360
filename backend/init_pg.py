import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def setup_postgres():
    conn = psycopg2.connect(dbname='postgres', user='postgres', password='root', host='localhost', port=5432)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute("SELECT datname FROM pg_database;")
    dbs = [r[0] for r in cur.fetchall()]
    print("Databases:", dbs)

    cur.execute("SELECT rolname FROM pg_roles;")
    roles = [r[0] for r in cur.fetchall()]
    print("Roles:", roles)

    if 'dealflow360' not in roles:
        print("Creating role dealflow360...")
        cur.execute("CREATE ROLE dealflow360 WITH LOGIN PASSWORD 'dealflow360pass' CREATEDB SUPERUSER;")
    else:
        print("Role dealflow360 exists, updating password and permissions...")
        cur.execute("ALTER ROLE dealflow360 WITH LOGIN PASSWORD 'dealflow360pass' CREATEDB SUPERUSER;")

    if 'dealflow360' not in dbs:
        print("Creating database dealflow360...")
        cur.execute("CREATE DATABASE dealflow360 OWNER dealflow360;")
    else:
        print("Database dealflow360 already exists.")

    cur.close()
    conn.close()
    print("PostgreSQL setup successfully finished!")

if __name__ == '__main__':
    setup_postgres()
