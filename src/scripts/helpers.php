<?php

use Illuminate\Database\Eloquent\Model;

function json_output(mixed $data): never
{
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit(0);
}

function error_output(string $message, int $code = 1): never
{
    fwrite(STDERR, $message . PHP_EOL);
    exit($code);
}

if (! function_exists('array_find')) {
    function array_find(array $array, callable $callback, string $use = 'BOTH'): mixed
    {
        if (! in_array($use, ['KEY', 'VALUE', 'BOTH'])) {
            throw new InvalidArgumentException("Invalid use {$use} in array_find");
        }

        foreach ($array as $key => $value) {
            switch ($use) {
                case 'KEY':
                    if ($callback($key)) {
                        return $value;
                    }
                    break;
                case 'VALUE':
                    if ($callback($value)) {
                        return $value;
                    }
                    break;
                default:
                    if ($callback($value, $key)) {
                        return $value;
                    }
                    break;
            }
        }

        return null;
    }
}

function class_extends_model(string $classFilePath, ?string $class = null): bool
{
    if (! is_file($classFilePath)) {
        return false;
    }

    $class ??= get_fully_qualified_class_name($classFilePath);

    if (!class_exists($class)) {
        require_once $classFilePath;
    }

    return is_subclass_of($class, Model::class);
}

function get_default_php_token(string|int|null|PhpToken $token, array $tokensArray = []): PhpToken
{
    $defaultToken = new PhpToken(T_WHITESPACE, " ");

    return match (true) {
        is_a($token, PhpToken::class) => $token,
        is_string($token) || is_int($token) => $tokensArray[$token] ?? $defaultToken,
        default => $defaultToken
    };
}

function get_fully_qualified_class_name(string $classFilePath): ?string
{
    if (! is_file($classFilePath)) {
        return false;
    }

    $code = file_get_contents($classFilePath);

    if ($code === false) {
        return false;
    }

    $tokens = PhpToken::tokenize($code);
    $namespace = array_find($tokens, use: 'KEY', callback: fn(int $key) => get_default_php_token($key - 2, $tokens)->is(T_NAMESPACE))?->text;
    $currentClass = array_find($tokens, use: 'KEY', callback: fn(int $key) => get_default_php_token($key - 2, $tokens)->is(T_CLASS))?->text;

    return $namespace ? "$namespace\\$currentClass" : $currentClass;
}

function parse_model_relations(Model $model): array
{
    $reflection = new ReflectionClass($model);

    $methods = $reflection->getMethods(ReflectionMethod::IS_PUBLIC);
    $relations = [];

    foreach ($methods as $method) {
        $type = null;
        if ($method->class !== get_class($model)) {
            continue;
        }

        if ($method->getNumberOfParameters() > 0) {
            continue;
        }

        if (! $method->hasReturnType() || $method->getReturnType()->isBuiltin()) {
            $docComment = $method->getDocComment();
            if ($docComment === false) {
                continue;
            }

            if (! preg_match('/@return\s+(?<type>[^\s]+)/', $docComment, $match)) {
                continue;
            }

            $type = $match['type'];
        }

        $type ??= $method->getReturnType()->getName();

        if (! is_subclass_of($type, Illuminate\Database\Eloquent\Relations\Relation::class)) {
            continue;
        }

        $relation = $method->invoke($model);

        $relations[] = [
            'name' => $method->getName(),
            'type' => basename($relation::class),
            'relatedModel' => get_class($relation->getRelated()),
        ];
    }

    return $relations;
}

function parse_model_info(string $modelClass): array
{
    $model = new $modelClass();

    $reflection = new ReflectionClass($model);

    return [
        'name' => $reflection->getShortName(),
        'namespace' => $reflection->getNamespaceName(),
        'table' => $model->getTable(),
        'fillable' => $model->getFillable(),
        'hidden' => $model->getHidden(),
        'casts' => $model->getCasts(),
        'relationships' => parse_model_relations($model),
        'traits' => $reflection->getTraitNames(),
        'uri' => $reflection->getFileName(),
    ];
}

function find_php_files($dir)
{
    $directory = new RecursiveDirectoryIterator($dir);
    $flattened = new RecursiveIteratorIterator($directory);
    $files = iterator_to_array(new RegexIterator($flattened, '/^.+\.php$/i'));

    return array_keys($files);
}
