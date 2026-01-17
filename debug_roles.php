
foreach(App\Models\User::all() as $u) {
    echo "USER_INFO: " . $u->id . '|' . $u->email . '|' . $u->getRoleNames()->implode(',') . "\n";
}
