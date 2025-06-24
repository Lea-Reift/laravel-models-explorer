<?php

use Illuminate\Database\Eloquent\Model;

if (! function_exists('json_output')) {
    function json_output($data): never
    {
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit(0);
    }
}

if (! function_exists('error_output')) {
    function error_output($message, $code = 1): never
    {
        fwrite(STDERR, $message . PHP_EOL);
        exit($code);
    }
}

if (! function_exists('array_find')) {
    function array_find($array, $callback, $use = 'BOTH')
    {
        if (! in_array($use, ['KEY', 'VALUE', 'BOTH'])) {
            throw new InvalidArgumentException("Invalid use {$use} in array_find");
        }

        foreach ($array as $key => $value) {
            $result = false;
            switch ($use) {
                case 'VALUE':
                    $result = $callback($value);
                    break;

                case 'KEY':
                    $result = $callback($key);
                    break;
                default:
                    $result = $callback($value, $key);
                    break;
            }

            if ($result) {
                return $value;
            }
        }

        return null;
    }
}

if (! function_exists('class_extends_model')) {
    function class_extends_model($classFilePath, $class = null): bool
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
}

if (! function_exists('get_default_php_token')) {
    function get_default_php_token($token, $tokensArray = []): PhpToken
    {
        $defaultToken = new PhpToken(T_WHITESPACE, " ");

        switch (true) {
            case is_a($token, PhpToken::class):
                return $token;
                break;

            case is_string($token) || is_int($token):
                return $tokensArray[$token] ?? $defaultToken;
                break;

            default:
                return $defaultToken;
                break;
        }
    }
}

if (! function_exists('get_fully_qualified_class_name')) {
    function get_fully_qualified_class_name($classFilePath): ?string
    {
        if (! is_file($classFilePath)) {
            return null;
        }

        $code = file_get_contents($classFilePath);

        if ($code === false) {
            return null;
        }

        $tokens = PhpToken::tokenize($code);
        $currentClass = array_find($tokens, fn($key) => get_default_php_token($key - 2, $tokens)->is(T_CLASS), 'KEY');

        if (is_null($currentClass)) {
            return null;
        }

        $currentClass = $currentClass->text;
        $tokensByLine = array_group_by($tokens, fn(PhpToken $token) => $token->line);

        $namespace = array_find($tokens, fn($key) => get_default_php_token($key - 2, $tokens)->is(T_NAMESPACE), 'KEY');

        if (!is_null($namespace)) {
            $namespaceLineTokens = array_filter(
                $tokensByLine[$namespace->line],
                fn(PhpToken $token) => !$token->is(T_WHITESPACE) && !$token->is(T_NAMESPACE) && !$token->is(59) //Semicolon
            );

            $namespaceLine = array_map(fn(PhpToken $token) => $token->text, $namespaceLineTokens);
            $namespace = implode("", $namespaceLine);
        }

        return $namespace ? "$namespace\\$currentClass" : $currentClass;
    }
}

if (!function_exists('array_group_by')) {
    function array_group_by($array, $groupBy)
    {
        $result = [];

        foreach ($array as $key => $value) {
            $groupByKey = is_callable($groupBy) ? $groupBy($value, $key) : $groupBy;
            $result[$groupByKey][] = $value;
        }

        return $result;
    }
}

if (! function_exists('parse_model_relations')) {
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
                'type' => basename(get_class($relation)),
                'relatedModel' => get_class($relation->getRelated()),
            ];
        }

        return $relations;
    }
}

if (! function_exists('parse_model_info')) {
    function parse_model_info($modelClass): array
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
}

if (! function_exists('find_php_files')) {
    function find_php_files($dir)
    {
        $directory = new RecursiveDirectoryIterator($dir);
        $flattened = new RecursiveIteratorIterator($directory);
        $files = iterator_to_array(new RegexIterator($flattened, '/^.+\.php$/i'));

        return array_keys($files);
    }
}
