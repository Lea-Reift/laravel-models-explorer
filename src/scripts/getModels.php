<?php
require_once __DIR__ . '/helpers.php';

if (PHP_MAJOR_VERSION < 7 || (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION < 4)) {
    $currentVersion = PHP_VERSION;
    error_output("Version error - PHP version 7.4 or greater is required to run this script (current version is {$currentVersion})", 1);
}

//Change Directory to workspace
if (!is_dir($workspace = $argv[1])) {
    error_output("Argument exception -'{$workspace}' is not a valid directory", 2);
}

chdir($workspace);

require_once 'vendor/autoload.php';

if (($currentVersion = (float)Illuminate\Foundation\Application::VERSION) < 8) {
    error_output("Version error - Laravel version 8 or greater is required to run this script (current version is {$currentVersion})", 1);
}

//Bootstrap App
(require_once 'bootstrap/app.php')
    ->make(Illuminate\Contracts\Console\Kernel::class)
    ->bootstrap();


//Register Error Handlers
set_exception_handler(fn(Throwable $e) => error_output("Runtime Exception - {$e->getMessage()}", $e->getCode() ?: 1));

set_error_handler(function (int $errno, string $errstr) {
    $errorCode = 1;
    switch ($errno) {
        case E_ERROR:
        case E_PARSE:
        case E_CORE_ERROR:
        case E_COMPILE_ERROR:
            $errorCode = 255;
            break;
        case E_NOTICE:
        case E_USER_NOTICE:
        case E_STRICT:
        case E_DEPRECATED:
        case E_USER_DEPRECATED:
            $errorCode = 1;
            break;
        default:
            $errorCode = 7;
            break;
    }
    file_put_contents(__DIR__ . "/var.php", "<?php\nreturn " . var_export(debug_backtrace(), true));
    error_output("Runtime Error - {$errstr}", $errorCode);
});

register_shutdown_function(function () {
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        return;
    }
    error_output("Critical Error - {$e['message']}", 255);
});

//Get project classes
try {
    $projectNamespaces = json_decode(file_get_contents("composer.json"), true, 512, JSON_THROW_ON_ERROR)['autoload']['psr-4'];
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
$modelsInfo = array_map(fn(string $class) => parse_model_info($class), $models);

json_output($modelsInfo);
