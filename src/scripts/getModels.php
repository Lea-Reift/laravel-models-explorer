<?php

//Change Directory to workspace
if (!is_dir($workspace = $argv[1])) {
    error_output("'{$workspace}' is not a valid directory", 2);
}

chdir($workspace);

require_once __DIR__ . '/helpers.php';
require_once 'vendor/autoload.php';

//Bootstrap App
(require_once 'bootstrap/app.php')
    ->make(Illuminate\Contracts\Console\Kernel::class)
    ->bootstrap();

//Register Error Handlers
set_exception_handler(fn(Throwable $e) => error_output("Runtime exception - {$e->getMessage()} {$e->getFile()} {$e->getLine()}", $e->getCode() ?: 1));

set_error_handler(fn(int $errno, string $errstr) => error_output("Runtime error - {$errstr}", match ($errno) {
    E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR => 255,
    E_NOTICE, E_USER_NOTICE, E_STRICT, E_DEPRECATED, E_USER_DEPRECATED => 1,
    default => 7
}));

register_shutdown_function(function () {
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        return;
    }
    error_output("Critic error - {$e['type']}", 255);
});

//Get project classes
try {
    $projectNamespaces = json_decode(file_get_contents("composer.json"), true, flags: JSON_THROW_ON_ERROR)['autoload']['psr-4'];
} catch (\ErrorException $e) {
    throw new RuntimeException("'composer.json' file is missing.", 4);
}

$models = [];

foreach ($projectNamespaces as $namespacePath) {
    foreach (find_php_files($namespacePath) as $filePath) {
        $class = get_fully_qualified_class_name($filePath);
        if (is_null($class) || !class_extends_model($filePath)) {
            continue;
        }
        $models[] = $class;
    }
}

//Parse models into extension structure
$modelsInfo = array_map(array: $models, callback: fn(string $class) => parse_model_info($class));

json_output($modelsInfo);
