if [ $# -eq 0 ]
  then
    bundle exec ruby test/test_batch.rb
else
  if [ $1 == "render" ]
    then
      bundle exec ruby test/render_test.rb fast
  fi
fi
