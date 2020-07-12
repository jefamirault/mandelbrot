@echo off

SET arg="%~1"
if NOT %arg%=="" (
    if %arg%=="render" (
        bundle exec ruby test/render_test.rb fast
    )
) else (
    bundle exec ruby test/test_batch.rb
)
