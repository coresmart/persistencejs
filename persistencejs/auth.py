from base import ReadOnlyPersistentRecord

class UserRecord(ReadOnlyPersistentRecord):
    id_field = 'username'
    created_field = 'date_joined'
    modified_field = 'date_joined'
    deleted_field = None

    fields = ["username", "first_name", "last_name", "email"]