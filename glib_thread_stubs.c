/*
 * Stub implementations for GLib threading primitives
 * For single-threaded Emscripten/WASM builds where threading is disabled
 *
 * These are just no-op stubs for single-threaded execution.
 */

#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* Use void* for all opaque GLib types */
typedef void* gpointer;
typedef const void* gconstpointer;
typedef int gboolean;
typedef size_t gsize;
typedef int64_t gint64;
typedef unsigned int guint;
typedef char gchar;

#define TRUE 1
#define FALSE 0

/* Forward declare GError for thread creation */
typedef struct {
    int domain;
    int code;
    char *message;
} GError;

/* Mutex stubs - no-ops for single-threaded */
void g_mutex_lock(void *mutex) { (void)mutex; }
void g_mutex_unlock(void *mutex) { (void)mutex; }
gboolean g_mutex_trylock(void *mutex) { (void)mutex; return TRUE; }
void g_mutex_init(void *mutex) { (void)mutex; }
void g_mutex_clear(void *mutex) { (void)mutex; }

/* RWLock stubs - no-ops for single-threaded */
void g_rw_lock_init(void *rw_lock) { (void)rw_lock; }
void g_rw_lock_clear(void *rw_lock) { (void)rw_lock; }
void g_rw_lock_writer_lock(void *rw_lock) { (void)rw_lock; }
gboolean g_rw_lock_writer_trylock(void *rw_lock) { (void)rw_lock; return TRUE; }
void g_rw_lock_writer_unlock(void *rw_lock) { (void)rw_lock; }
void g_rw_lock_reader_lock(void *rw_lock) { (void)rw_lock; }
gboolean g_rw_lock_reader_trylock(void *rw_lock) { (void)rw_lock; return TRUE; }
void g_rw_lock_reader_unlock(void *rw_lock) { (void)rw_lock; }

/* RecMutex stubs */
void g_rec_mutex_init(void *rec_mutex) { (void)rec_mutex; }
void g_rec_mutex_clear(void *rec_mutex) { (void)rec_mutex; }
void g_rec_mutex_lock(void *rec_mutex) { (void)rec_mutex; }
gboolean g_rec_mutex_trylock(void *rec_mutex) { (void)rec_mutex; return TRUE; }
void g_rec_mutex_unlock(void *rec_mutex) { (void)rec_mutex; }

/* Cond stubs */
void g_cond_init(void *cond) { (void)cond; }
void g_cond_clear(void *cond) { (void)cond; }
void g_cond_wait(void *cond, void *mutex) { (void)cond; (void)mutex; }
gboolean g_cond_wait_until(void *cond, void *mutex, gint64 end_time) {
    (void)cond; (void)mutex; (void)end_time; return TRUE;
}
void g_cond_signal(void *cond) { (void)cond; }
void g_cond_broadcast(void *cond) { (void)cond; }

/* Private (thread-local) stubs - simple static storage for single thread */
struct PrivateEntry {
    void *key;
    void *value;
    struct PrivateEntry *next;
};

static struct PrivateEntry *private_list = NULL;

gpointer g_private_get(void *key) {
    struct PrivateEntry *entry = private_list;
    while (entry) {
        if (entry->key == key) return entry->value;
        entry = entry->next;
    }
    return NULL;
}

void g_private_set(void *key, gpointer value) {
    struct PrivateEntry *entry = private_list;
    while (entry) {
        if (entry->key == key) {
            entry->value = value;
            return;
        }
        entry = entry->next;
    }
    /* Not found, add new entry */
    entry = (struct PrivateEntry *)malloc(sizeof(struct PrivateEntry));
    if (entry) {
        entry->key = key;
        entry->value = value;
        entry->next = private_list;
        private_list = entry;
    }
}

void g_private_replace(void *key, gpointer value) {
    g_private_set(key, value);
}

/* System thread stubs - these are the missing ones from the error */
void g_system_thread_set_name(const gchar *name) {
    (void)name;
    /* No-op: We can't set thread names in single-threaded WASM */
}

/*
 * g_system_thread_new signature from glib internal:
 * GRealThread* g_system_thread_new(GThreadFunc proxy, gulong stack_size,
 *                                   const char* name, GThreadFunc func,
 *                                   gpointer data, GError** error)
 * In WASM terms: (i32, i32, i32, i32, i32, i32) -> i32
 */
gpointer g_system_thread_new(gpointer proxy, gsize stack_size,
                              const gchar *name, gpointer func,
                              gpointer data, GError **error) {
    (void)proxy;
    (void)stack_size;
    (void)name;
    (void)func;
    (void)data;
    (void)error;
    /*
     * In single-threaded WASM, we cannot create new threads.
     * Return NULL to indicate failure, but don't set error
     * since most code paths that create threads are optional.
     */
    return NULL;
}

void g_system_thread_free(gpointer thread) {
    (void)thread;
    /* No-op: nothing to free in single-threaded mode */
}

void g_system_thread_wait(gpointer thread) {
    (void)thread;
}

void g_system_thread_exit(void) {
    /* No-op in single-threaded mode */
}

/* Thread pool stubs - GLib may use these */
void g_thread_pool_set_max_unused_threads(int max_threads) {
    (void)max_threads;
}

guint g_thread_pool_get_max_unused_threads(void) {
    return 0;
}

guint g_thread_pool_get_num_unused_threads(void) {
    return 0;
}

void g_thread_pool_stop_unused_threads(void) {
    /* No-op */
}

/* Note: g_bit_lock, g_bit_trylock, g_bit_unlock, g_pointer_bit_lock,
 * g_pointer_bit_trylock, g_pointer_bit_unlock are already defined in
 * libglib-2.0.a (gbitlock.c.o), so we don't stub them here.
 */
